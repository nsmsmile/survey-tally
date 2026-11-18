// index.html 페이지 자체에 대한 시험: 외부 자원·저장·전송이 없는지, CSP가 맞는지, .nojekyll이 있는지.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { html } from "./load-core.mjs";
import { withCsp } from "../tools/csp-hashes.mjs";

const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");

test(".nojekyll이 저장소 맨 위에 빈 파일로 있음", () => {
  const path = fileURLToPath(new URL("../.nojekyll", import.meta.url));
  assert.equal(statSync(path).size, 0);
});

test("외부 자원을 불러오지 않음(script src, link, @import, url(), http 주소 없음)", () => {
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i);
  assert.doesNotMatch(html, /<link\b/i);
  assert.doesNotMatch(html, /<(iframe|img|object|embed|video|audio|source)\b/i);
  assert.doesNotMatch(html, /@import|@font-face|url\s*\(/i);
  assert.doesNotMatch(html, /\b(https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}/i);
});

test("저장·전송 API를 쓰지 않음", () => {
  for (const api of [
    "localStorage", "sessionStorage", "indexedDB", "document.cookie", "fetch(", "XMLHttpRequest",
    "sendBeacon", "WebSocket", "EventSource", "navigator.clipboard", "postMessage", "eval(", "new Function",
    "innerHTML", "outerHTML", "insertAdjacentHTML", "document.write",
  ]) {
    assert.ok(!scripts.includes(api), `${api} 사용`);
  }
  assert.doesNotMatch(html, /<form\b/i);
});

test("CSP: 모든 것을 막고 인라인 스크립트·스타일은 해시로만 허용", () => {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/);
  assert.ok(m, "CSP meta 없음");
  const csp = m[1];
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|https?:|\*/);
  assert.equal(withCsp(html), html, "CSP 해시가 낡았습니다. npm run csp 를 실행하세요.");
});

test("인라인 이벤트 처리기 속성이 없음(CSP에서 막힘)", () => {
  const markup = html.replace(/<script\b[\s\S]*?<\/script>/g, "").replace(/<style\b[\s\S]*?<\/style>/g, "");
  assert.doesNotMatch(markup, /\son[a-z]+\s*=/i);
  assert.doesNotMatch(markup, /\sstyle\s*=/i);
});

test("입력칸은 자동완성·맞춤법 검사를 끔", () => {
  const ta = html.match(/<textarea\b[^>]*>/)[0];
  assert.match(ta, /autocomplete="off"/);
  assert.match(ta, /spellcheck="false"/);
});

test("결과 표 머리글: 문항 / 유효 응답 / 평균 / 빈 응답 / 제외", () => {
  const thead = html.match(/<thead>([\s\S]*?)<\/thead>/)[1];
  const cols = [...thead.matchAll(/<th\b[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(cols, ["문항", "유효 응답", "평균", "빈 응답", "제외"]);
});

test("계산 로직 블록은 DOM을 쓰지 않음", () => {
  const core = html.match(/<script id="tally-core">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(core, /\b(document|window|navigator)\b/);
});

test("package.json에 외부 의존성이 없음", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
});
