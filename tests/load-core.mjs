// index.html에서 <script id="tally-core"> 블록만 꺼내 격리된 vm 문맥에서 실행한다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

export const indexPath = fileURLToPath(new URL("../index.html", import.meta.url));
export const html = readFileSync(indexPath, "utf8");

export function loadCore() {
  const m = html.match(/<script id="tally-core">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('index.html에 <script id="tally-core">가 없습니다');
  const context = vm.createContext({});
  vm.runInContext(m[1], context, { filename: "index.html#tally-core" });
  return context.SurveyTally;
}
