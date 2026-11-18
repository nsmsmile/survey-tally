import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../omok/index.html", import.meta.url), "utf8");
const core = html.match(/<script id="omok-core">([\s\S]*?)<\/script>/)[1];
const context = vm.createContext({});
vm.runInContext(core, context);
const { SIZE, createGame, play, undo, findWinLine } = context.Omok;

const plain = (v) => JSON.parse(JSON.stringify(v));

// [row, col] 목록을 차례대로 둔다(흑부터 번갈아). 실패하면 시험 실패.
function playAll(moves, state = createGame()) {
  for (const [r, c] of moves) {
    const res = play(state, r, c);
    assert.ok(res.ok, `(${r},${c}) 착수 실패: ${res.reason}`);
    state = res.state;
  }
  return state;
}

test("새 게임: 10×10 빈 판, 흑 차례", () => {
  const g = createGame();
  assert.equal(SIZE, 10);
  assert.equal(g.size, 10);
  assert.equal(g.board.length, 100);
  assert.ok(g.board.every((v) => v === ""));
  assert.equal(g.turn, "black");
  assert.equal(g.winner, null);
});

test("흑·백이 번갈아 두고, 원래 상태는 바뀌지 않음", () => {
  const g0 = createGame();
  const g1 = play(g0, 4, 4).state;
  assert.equal(g0.board[44], "");
  assert.equal(g1.board[44], "black");
  assert.equal(g1.turn, "white");
  const g2 = play(g1, 4, 5).state;
  assert.equal(g2.board[45], "white");
  assert.equal(g2.turn, "black");
});

test("이미 돌이 있는 곳·판 밖에는 둘 수 없음", () => {
  const g = playAll([[0, 0]]);
  assert.deepEqual(plain(play(g, 0, 0)), { ok: false, reason: "occupied" });
  for (const [r, c] of [[-1, 0], [0, -1], [10, 0], [0, 10], [1.5, 2]]) {
    assert.equal(play(g, r, c).reason, "out-of-range");
  }
});

// 흑이 line의 칸에, 백은 filler 칸에 번갈아 둔다.
function blackLine(line, filler) {
  const moves = [];
  line.forEach((p, i) => {
    moves.push(p);
    if (i < line.length - 1) moves.push(filler[i]);
  });
  return playAll(moves);
}

const FILLER = [[9, 0], [9, 2], [9, 4], [9, 6], [9, 8], [8, 9]];

test("가로 5목 승리", () => {
  const g = blackLine([[2, 1], [2, 2], [2, 3], [2, 4], [2, 5]], FILLER);
  assert.equal(g.winner, "black");
  assert.deepEqual(plain(g.winLine), [[2, 1], [2, 2], [2, 3], [2, 4], [2, 5]]);
});

test("세로 5목 승리(판 가장자리)", () => {
  const g = blackLine([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], [[0, 9], [1, 9], [2, 9], [3, 9]]);
  assert.equal(g.winner, "black");
});

test("↘ 대각선 5목 승리", () => {
  const g = blackLine([[5, 5], [6, 6], [7, 7], [8, 8], [9, 9]], [[0, 9], [1, 9], [2, 9], [3, 9]]);
  assert.equal(g.winner, "black");
  assert.equal(g.winLine.length, 5);
});

test("↙ 대각선 5목 승리, 가운데를 마지막에 채워도 인식", () => {
  const g = blackLine([[0, 9], [1, 8], [3, 6], [4, 5], [2, 7]], [[9, 0], [9, 1], [9, 2], [9, 3]]);
  assert.equal(g.winner, "black");
  assert.deepEqual(plain(g.winLine), [[0, 9], [1, 8], [2, 7], [3, 6], [4, 5]]);
});

test("4목은 승리가 아님", () => {
  const g = blackLine([[2, 1], [2, 2], [2, 3], [2, 4]], FILLER);
  assert.equal(g.winner, null);
});

test("6목 이상도 승리(자유 오목)", () => {
  // 흑 ●●● _ ●● 에서 빈칸을 채워 6목
  const g = blackLine([[3, 0], [3, 1], [3, 2], [3, 4], [3, 5], [3, 3]], FILLER);
  assert.equal(g.winner, "black");
  assert.equal(g.winLine.length, 6);
});

test("백도 이길 수 있음", () => {
  const g = playAll([
    [9, 0], [0, 0], [9, 2], [0, 1], [9, 4], [0, 2], [9, 6], [0, 3], [8, 9], [0, 4],
  ]);
  assert.equal(g.winner, "white");
});

test("다른 색이 끼면 이어진 것으로 보지 않음", () => {
  const g = playAll([[5, 0], [5, 2], [5, 1], [9, 9], [5, 3], [9, 8], [5, 4], [9, 7], [5, 5]]);
  // 흑: (5,0)(5,1)(5,3)(5,4)(5,5) — (5,2)가 백이라 끊김
  assert.equal(g.winner, null);
});

test("승부가 나면 더 둘 수 없음", () => {
  const g = blackLine([[2, 1], [2, 2], [2, 3], [2, 4], [2, 5]], FILLER);
  assert.equal(play(g, 7, 7).reason, "game-over");
});

test("판이 다 차고 승자가 없으면 무승부", () => {
  // 가로는 흑흑백백… 두 칸씩, 줄마다 색이 뒤집히는 무늬: 어느 방향으로도 5목이 생기지 않는다.
  const colorOf = (r, c) => ((Math.floor(c / 2) + r) % 2 ? "white" : "black");
  const blacks = [];
  const whites = [];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) (colorOf(r, c) === "black" ? blacks : whites).push([r, c]);
  assert.equal(blacks.length, 50);
  const moves = [];
  for (let i = 0; i < 50; i++) moves.push(blacks[i], whites[i]);
  const g = playAll(moves);
  assert.equal(g.moves.length, 100);
  assert.equal(g.winner, "draw");
  assert.equal(play(g, 0, 0).reason, "game-over");
});

test("무르기: 마지막 수를 지우고 차례를 되돌림", () => {
  const g = playAll([[4, 4], [4, 5]]);
  const u = undo(g);
  assert.equal(u.board[45], "");
  assert.equal(u.board[44], "black");
  assert.equal(u.turn, "white");
  assert.equal(u.moves.length, 1);
  assert.equal(undo(undo(u)).moves.length, 0); // 빈 판에서 무르기해도 오류 없음
});

test("무르기: 승부가 난 뒤에도 되돌리면 다시 둘 수 있음", () => {
  const g = blackLine([[2, 1], [2, 2], [2, 3], [2, 4], [2, 5]], FILLER);
  const u = undo(g);
  assert.equal(u.winner, null);
  assert.deepEqual(plain(u.winLine), []);
  assert.equal(u.turn, "black");
  assert.ok(play(u, 7, 7).ok);
});

test("findWinLine: 빈칸이면 빈 목록", () => {
  assert.deepEqual(plain(findWinLine(createGame(), 0, 0)), []);
});

test("페이지: 외부 자원·네트워크·저장 API를 쓰지 않음", () => {
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=|<link\b|@import|url\s*\(/i);
  assert.doesNotMatch(html, /\b(https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}/i);
  for (const api of ["fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "localStorage", "sessionStorage", "indexedDB", "innerHTML"]) {
    assert.ok(!html.includes(api), `${api} 사용`);
  }
  assert.match(html, /Content-Security-Policy" content="default-src 'none'/);
});

test("페이지: 게임 로직 블록은 DOM을 쓰지 않음", () => {
  assert.doesNotMatch(core, /\b(document|window|navigator)\b/);
});
