"use strict";

const { ServiceBroker } = require("moleculer");
const ApiGateway = require("moleculer-web");
const axios = require("axios");
const DbService = require("../..").Service;

module.exports = getAdapter => {
	describe("Test REST API with populates", () => {
		const env = createEnvironment(getAdapter);
		const docs = [];

		beforeAll(() => env.start());
		afterAll(() => env.stop());

		describe("Common flow", () => {
			it("should return empty array", async () => {
				const res = await axios.get(`${env.baseURL}/posts`);
				const data = res.data;

				expect(data).toEqual({
					rows: [],
					page: 1,
					pageSize: 10,
					total: 0,
					totalPages: 0
				});
			});

			it("should throw validation error", async () => {
				expect.assertions(5);
				try {
					await axios.post(`${env.baseURL}/posts`, { votes: 3 });
				} catch (error) {
					const err = error.response.data;
					expect(err.name).toBe("ValidationError");
					expect(err.message).toEqual("The 'title' field is required");
					expect(err.type).toEqual("REQUIRED_FIELD");
					expect(err.code).toEqual(422);
					expect(err.data).toEqual({ field: "title", value: undefined });
				}
			});

			it("should create posts", async () => {
				const doc = (
					await axios.post(`${env.baseURL}/posts`, {
						title: "First post",
						content: "Content of first post",
						author: "John Doe"
					})
				).data;
				docs.push(doc);

				expect(doc).toEqual({
					_id: expect.any(String),
					title: "First post",
					content: "Content of first post",
					author: "John Doe",
					votes: 0,
					status: true,
					createdAt: expect.any(Number)
				});

				docs.push(
					(
						await axios.post(`${env.baseURL}/posts`, {
							title: "Second post",
							content: "Content of second post",
							author: "Jane Doe",
							status: false
						})
					).data
				);

				docs.push(
					(
						await axios.post(`${env.baseURL}/posts`, {
							title: "Third post",
							content: "Content of thord post",
							author: "John Smith",
							votes: 3
						})
					).data
				);
			});

			it("should return all docs (list)", async () => {
				const data = (await axios.get(`${env.baseURL}/posts`)).data;
				expect(data).toEqual({
					rows: expect.arrayContaining(docs),
					page: 1,
					pageSize: 10,
					total: 3,
					totalPages: 1
				});
			});

			it("should return all docs (find)", async () => {
				const data = (await axios.get(`${env.baseURL}/posts/all`)).data;
				expect(data).toEqual(expect.arrayContaining(docs));
			});

			it("should return a doc (GET)", async () => {
				const data = (await axios.get(`${env.baseURL}/posts/${docs[0]._id}`)).data;
				expect(data).toEqual(docs[0]);
			});

			it("should update entity", async () => {
				const doc = (
					await axios.patch(`${env.baseURL}/posts/${docs[1]._id}`, {
						title: "Modified post"
					})
				).data;
				docs[1] = doc;

				expect(doc).toEqual({
					_id: expect.any(String),
					title: "Modified post",
					content: "Content of second post",
					author: "Jane Doe",
					votes: 0,
					status: false,
					createdAt: expect.any(Number),
					updatedAt: expect.any(Number)
				});
			});

			it("should return the modified doc (GET)", async () => {
				const data = (await axios.get(`${env.baseURL}/posts/${docs[1]._id}`)).data;
				expect(data).toEqual(docs[1]);
			});

			it("should remove a doc (DELETE)", async () => {
				const data = (await axios.delete(`${env.baseURL}/posts/${docs[1]._id}`)).data;
				expect(data).toEqual(docs[1]._id);
			});

			it("should throw error while getting the removed doc", async () => {
				expect.assertions(6);
				try {
					await axios.get(`${env.baseURL}/posts/${docs[1]._id}`);
				} catch (error) {
					const err = error.response.data;
					expect(error.response.status).toBe(404);
					expect(err.name).toBe("EntityNotFoundError");
					expect(err.message).toEqual("Entity not found");
					expect(err.type).toEqual("ENTITY_NOT_FOUND");
					expect(err.code).toEqual(404);
					expect(err.data).toEqual({ id: docs[1]._id });
				}
			});

			it("should return all docs (list)", async () => {
				const data = (await axios.get(`${env.baseURL}/posts`)).data;
				expect(data).toEqual({
					rows: expect.arrayContaining([docs[0], docs[2]]),
					page: 1,
					pageSize: 10,
					total: 2,
					totalPages: 1
				});
			});
		});

		describe("Authors with scopes & softDelete", () => {
			it("should return all authors (list)", async () => {
				const data = (await axios.get(`${env.baseURL}/authors`)).data;
				expect(data).toEqual({
					rows: expect.arrayContaining(Object.values(env.authors)),
					page: 1,
					pageSize: 10,
					total: 4,
					totalPages: 1
				});
			});

			it("should return only active authors", async () => {
				const data = (await axios.get(`${env.baseURL}/authors?scope=onlyActive`)).data;
				expect(data).toEqual({
					rows: expect.arrayContaining([
						env.authors.johnDoe,
						env.authors.janeDoe,
						env.authors.kevinJames
					]),
					page: 1,
					pageSize: 10,
					total: 3,
					totalPages: 1
				});
			});

			it("should soft remove a author (DELETE)", async () => {
				const data = (
					await axios.delete(`${env.baseURL}/authors/${env.authors.kevinJames._id}`)
				).data;
				expect(data).toEqual(env.authors.kevinJames._id);
			});

			it("should return not deleted authors", async () => {
				const data = (await axios.get(`${env.baseURL}/authors`)).data;
				expect(data).toEqual({
					rows: expect.arrayContaining([
						env.authors.johnDoe,
						env.authors.janeDoe,
						env.authors.bobSmith
					]),
					page: 1,
					pageSize: 10,
					total: 3,
					totalPages: 1
				});
			});

			it("should return all (including deleted) authors (list)", async () => {
				const data = (await axios.get(`${env.baseURL}/authors?scope=false`)).data;
				expect(data).toEqual({
					rows: expect.arrayContaining([
						env.authors.johnDoe,
						env.authors.janeDoe,
						env.authors.bobSmith,
						Object.assign({}, env.authors.kevinJames, { deletedAt: expect.any(Number) })
					]),
					page: 1,
					pageSize: 10,
					total: 4,
					totalPages: 1
				});
			});

			it("should throw error accessing deleted author", async () => {
				expect.assertions(6);
				try {
					await axios.get(`${env.baseURL}/authors/${env.authors.kevinJames._id}`);
				} catch (error) {
					const err = error.response.data;
					expect(error.response.status).toBe(404);
					expect(err.name).toBe("EntityNotFoundError");
					expect(err.message).toEqual("Entity not found");
					expect(err.type).toEqual("ENTITY_NOT_FOUND");
					expect(err.code).toEqual(404);
					expect(err.data).toEqual({ id: env.authors.kevinJames._id });
				}
			});
		});
	});
};

function createEnvironment(getAdapter) {
	const env = {
		brokers: [],
		port: null,
		baseURL: null,
		authors: {}
	};

	// --- BROKER FOR API GATEWAY
	const apiBroker = new ServiceBroker({
		nodeID: "api-gw",
		transporter: "Fake",
		logger: false
	});

	apiBroker.createService({
		name: "api",
		mixins: [ApiGateway],
		settings: {
			port: 0,
			routes: [
				{
					path: "/api",
					autoAliases: true,
					mappingPolicy: "restrict"
				}
			]
		},

		dependencies: ["posts", "authors"],

		started() {
			const addr = this.server.address();
			env.port = addr.port;
			env.baseURL = `http://localhost:${env.port}/api`;
		}
	});
	env.brokers.push(apiBroker);

	// --- BROKER FOR POSTS SERVICE
	const postBroker = new ServiceBroker({
		nodeID: "broker-1",
		transporter: "Fake",
		logger: false
	});

	postBroker.createService({
		name: "posts",
		mixins: [DbService({ adapter: getAdapter("posts") })],
		settings: {
			fields: {
				id: { type: "string", primaryKey: true, columnName: "_id" },
				title: { type: "string", trim: true, required: true },
				content: { type: "string" },
				author: { type: "string" },
				votes: { type: "number", default: 0 },
				status: { type: "boolean", default: true },
				createdAt: { type: "number", onCreate: Date.now },
				updatedAt: { type: "number", onUpdate: Date.now }
			}
		},

		methods: {},

		async started() {
			await this.clearEntities();
		}
	});
	env.brokers.push(postBroker);

	// --- BROKER FOR AUTHORS SERVICE
	const authorBroker = new ServiceBroker({
		nodeID: "broker-2",
		transporter: "Fake",
		logger: false
	});

	authorBroker.createService({
		name: "authors",
		mixins: [DbService({ adapter: getAdapter("authors") })],
		settings: {
			fields: {
				id: { type: "string", primaryKey: true, columnName: "_id" },
				name: { type: "string", trim: true, required: true },
				age: { type: "number" },
				status: { type: "boolean", default: true },
				createdAt: { type: "number", onCreate: Date.now },
				updatedAt: { type: "number", onUpdate: Date.now },
				deletedAt: { type: "number", onRemove: Date.now }
			},

			scopes: {
				notDeleted: { deletedAt: { $exists: false } },
				onlyActive: { status: true }
			},
			defaultScopes: ["notDeleted"]
		},

		methods: {},

		async started() {
			await this.clearEntities();

			env.authors.johnDoe = await this.createEntity(null, {
				name: "John Doe",
				age: 42,
				status: true
			});
			env.authors.janeDoe = await this.createEntity(null, {
				name: "Jane Doe",
				age: 35,
				status: true
			});
			env.authors.bobSmith = await this.createEntity(null, {
				name: "Bob Smith",
				age: 58,
				status: false
			});
			env.authors.kevinJames = await this.createEntity(null, {
				name: "Kevin James",
				age: 48,
				status: true
			});
		}
	});
	env.brokers.push(authorBroker);

	env.start = () => apiBroker.Promise.all(env.brokers.map(broker => broker.start())).delay(1000);
	env.stop = () => Promise.all(env.brokers.map(broker => broker.stop()));

	return env;
}
