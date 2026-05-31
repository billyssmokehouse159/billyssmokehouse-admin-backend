import express, { type Request } from "express";
import dotenv from "dotenv";
import cors from "cors";
import { authRouter } from "./routes";

dotenv.config();
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded());

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.use(authRouter);

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
