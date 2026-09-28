import morgan from "morgan";
import { morganStream } from "../config/logger";

export const requestLogger = morgan("combined", { stream: morganStream });
