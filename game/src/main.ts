import "./styles.css";
import { startApp } from "./app";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Falta <div id=\"app\"> en index.html.");
startApp(root);
