// index.html 안의 인라인 <script>·<style> 내용으로 sha256 해시를 계산해 CSP의 script-src·style-src를 갱신한다.
// 사용: npm run csp   (스크립트나 스타일을 고친 뒤 실행. tests/page.test.mjs가 해시 일치를 확인한다.)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

export function inlineHashes(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  return [...html.matchAll(re)].map(
    (m) => `'sha256-${createHash("sha256").update(m[1], "utf8").digest("base64")}'`,
  );
}

export function withCsp(html) {
  const scripts = inlineHashes(html, "script").join(" ");
  const styles = inlineHashes(html, "style").join(" ");
  return html
    .replace(/script-src [^;"]*/, `script-src ${scripts}`)
    .replace(/style-src [^;"]*/, `style-src ${styles}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = fileURLToPath(new URL("../index.html", import.meta.url));
  const html = readFileSync(path, "utf8");
  const next = withCsp(html);
  if (next !== html) writeFileSync(path, next);
  console.log(next === html ? "CSP 해시가 이미 최신입니다." : "CSP 해시를 갱신했습니다.");
}
