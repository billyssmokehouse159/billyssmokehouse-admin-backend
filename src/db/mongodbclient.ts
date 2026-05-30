import { MongoClient, ServerApiVersion } from "mongodb"
import dotenv from "dotenv";
dotenv.config();

const MONGO_DB_URI = process.env.db_uri || ""

class MongoDbClient {
  private static client: MongoClient;

  static async getClient() {
    try {
      const { client: existingClient } = this;

      if (existingClient) return existingClient;

      this.client = new MongoClient(MONGO_DB_URI, {
        serverApi: ServerApiVersion.v1,
      });
      await this.client.connect();

      return this.client;
    } catch (error) {
      console.log("error connecting to database", error);
      throw error;
    }
  }

  static async closeClient() {
    try {
      const { client: existingClient } = this;

      if (!existingClient) {
        return;
      }

      await this.client.close();
    } catch (error) {}
  }
}

export { MongoDbClient };