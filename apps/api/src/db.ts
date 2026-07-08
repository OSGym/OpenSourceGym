import { MongoClient } from "mongodb";
import { env } from "./env.js";

export const mongoClient = new MongoClient(env.mongodbUri);
export const db = mongoClient.db();
