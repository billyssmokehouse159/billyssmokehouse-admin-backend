import express, { type Request } from "express";
import dotenv from "dotenv";
import { google } from "googleapis";
import { jwtDecode } from "jwt-decode";

import { MongoDbClient } from "../db/mongodbclient"
import { UserInfo } from "./types";


dotenv.config();

const OAUTH_CLIENT_ID = process.env.OAuthClientId;
const OAUTH_CLIENT_SECRET = process.env.OAuthClientSecret;
const OAUTH_REDIRECT_URL =
  process.env.ENV === "dev"
    ? process.env.dev_OAuthRedirectUri
    : process.env.ENV === "staging"
    ? process.env.staging_OAuthRedirectUri
    : process.env.OAuthRedirectUri;

const DB_NAME =
  process.env.ENV === "dev"
    ? process.env.dev_db_name
    : process.env.ENV === "staging"
    ? process.env.dev_db_name
    : process.env.db_name;
const USER_COLLECTION = process.env.db_user_collection || ""

const authRouter = express.Router();



authRouter.get("/auth-url", (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET,
    OAUTH_REDIRECT_URL
  );

  const scopes = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ];

  // Generate a url that asks permissions for the Drive activity and Google Calendar scope
  const authorizationUrl = oauth2Client.generateAuthUrl({
    // 'online' (default) or 'offline' (gets refresh_token)
    access_type: "offline",
    /** Pass in the scopes array defined above.
     * Alternatively, if only one scope is needed, you can pass a scope URL as a string */
    scope: scopes,
    // Enable incremental authorization. Recommended as a best practice.
    include_granted_scopes: true,
    // // Include the state parameter to reduce the risk of CSRF attacks.
    // state: state,
  });

  res.send({ authorizationUrl });
});

authRouter.post(
  "/get-tokens",
  async (req: Request<{}, {}, { code: string }>, res) => {
    const { code } = req.body;

    const oauth2Client = new google.auth.OAuth2(
      OAUTH_CLIENT_ID,
      OAUTH_CLIENT_SECRET,
      OAUTH_REDIRECT_URL
    );

    let { tokens, ...value } = await oauth2Client.getToken(code as string);

    const idToken = tokens.id_token;
    const userinfo: UserInfo = jwtDecode(idToken || "");

    const { email, name, picture } = userinfo;
    const formattedEmail = email.toLowerCase();

    const dbClient = await MongoDbClient.getClient();
    const collection = dbClient.db(DB_NAME).collection(USER_COLLECTION);

    const existingUser = await collection.findOne({
      email: formattedEmail,
    });

    if (!existingUser) {
      res.send({
        success: false,
      });
    }
    if (existingUser) {
      await collection.updateOne(
        { email: formattedEmail },
        {
          $set: {
            email: formattedEmail,
            name,
            picture,
            ...tokens,
          },
        }
      );
    }

    res.send({
      success: true,
      jwtToken: tokens.id_token,
      email: formattedEmail,
      name,
      picture,
    });
  }
);

authRouter.post("/verify-token", async (req, res) => {
  try {
    const headers = req.headers;
    const { email } = req.body;

    const token = headers["authorization"]?.split(" ")[1] || "";

    if (!token || !email) {
      return res
        .status(401)
        .send({ validJwt: false, error: "No token or user provided" });
    }

    const payloadBase64 = token.split(".")[1];
    const payloadJson = Buffer.from(payloadBase64, "base64").toString("utf-8");
    const payload = JSON.parse(payloadJson);

    const currentTime = Math.floor(Date.now() / 1000);

    if (!payload.exp || currentTime >= payload.exp) {
      return res.send({ validJwt: false });
    }

    const formattedEmail = email.toLowerCase();

    const dbClient = await MongoDbClient.getClient();
    const collection = dbClient.db(DB_NAME).collection(USER_COLLECTION);

    const existingUser = await collection.findOne({
      email: formattedEmail,
    });

    if (!existingUser) {
      return res.send({ validJwt: false });
    }

    if (existingUser.id_token !== token) {
      return res.send({ validJwt: false });
    }

    return res.send({ validJwt: true });
  } catch (error) {
    console.error("Invalid JWT", error);
    return res.status(400).send({ validJwt: false, error: "Invalid JWT" });
  }
});

export {authRouter}