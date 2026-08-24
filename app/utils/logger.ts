import { createConsola } from "consola";

const isProd = typeof import.meta.env !== "undefined" && import.meta.env.PROD;

export const logger = createConsola({
  level: isProd ? 1 : 4, // error in prod, debug in dev
  formatOptions: {
    date: !isProd,
    colors: !isProd,
  },
});

export default logger;
