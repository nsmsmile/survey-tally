import test from "node:test";
import assert from "node:assert/strict";
import { loadCore } from "./load-core.mjs";

const { parseTsv, classifyCell, formatAverage, tally } = loadCore();

// vm 문맥에서 만든 배열·객체는 프로토타입이 달라 deepStrictEqual이 실패하므로 JSON으로 옮긴다.
const plain = (v) => JSON.parse(JSON.stringify(v));

test("classifyCell: 앞뒤 공백을 지운 1~5는 유효", () => {
  for (const v of ["1", "2", "3", "4", "5", " 3", "4 ", "\t5\t", " 2　"]) {
    assert.equal(classifyCell(v), "valid", JSON.stringify(v));
  }
});

test("classifyCell: 비었거나 공백만 있으면 빈 응답", () => {
  for (const v of ["", " ", "   ", " ", "　", undefined]) {
    assert.equal(classifyCell(v), "blank", JSON.stringify(v));
  }
});

test("classifyCell: 그 밖의 값은 제외", () => {
  for (const v of ["0", "6", "3.0", "03", "-1", "+3", "1 2", "12", "３", "abc", "모름", '"3"', "3점"]) {
    assert.equal(classifyCell(v), "excluded", JSON.stringify(v));
  }
});

test("formatAverage: 유효 0이면 -", () => {
  assert.equal(formatAverage(0, 0), "-");
});

test("formatAverage: 둘째 자리까지 0을 채워 표시", () => {
  assert.equal(formatAverage(3, 1), "3.00");
  assert.equal(formatAverage(9, 2), "4.50");
  assert.equal(formatAverage(5, 1), "5.00");
});

test("formatAverage: 소수 셋째 자리에서 반올림", () => {
  assert.equal(formatAverage(10, 3), "3.33"); // 3.333…
  assert.equal(formatAverage(11, 3), "3.67"); // 3.666…
  assert.equal(formatAverage(7, 6), "1.17"); // 1.1666…
  assert.equal(formatAverage(2, 3), "0.67");
});

test("formatAverage: 셋째 자리가 정확히 5면 올림(부동소수점 오차 없음)", () => {
  // 1.005, 1.015 등은 Number.toFixed로는 틀리게 나오는 대표적인 값
  assert.equal(formatAverage(201, 200), "1.01"); // 1.005
  assert.equal(formatAverage(203, 200), "1.02"); // 1.015
  assert.equal(formatAverage(209, 200), "1.05"); // 1.045
  assert.equal(formatAverage(1001, 400), "2.50"); // 2.5025 → 2.50
  assert.equal(formatAverage(1003, 400), "2.51"); // 2.5075 → 2.51
  assert.equal(formatAverage(5 * 200 - 1, 200), "5.00"); // 4.995 → 5.00
});

test("parseTsv: 탭과 줄바꿈(\\r\\n, \\n, \\r)", () => {
  assert.deepEqual(plain(parseTsv("a\tb\r\n1\t2\n3\t4\r5\t6")), [
    ["a", "b"],
    ["1", "2"],
    ["3", "4"],
    ["5", "6"],
  ]);
});

test("parseTsv: 끝 줄바꿈과 길이 0인 줄은 무시, 탭만 있는 줄은 남김", () => {
  assert.deepEqual(plain(parseTsv("a\tb\r\n\r\n1\t2\r\n\t\r\n\r\n")), [
    ["a", "b"],
    ["1", "2"],
    ["", ""],
  ]);
});

test("parseTsv: 빈 칸과 줄 끝 탭", () => {
  assert.deepEqual(plain(parseTsv("a\t\tc\n\t2\t")), [
    ["a", "", "c"],
    ["", "2", ""],
  ]);
});

test("parseTsv: 엑셀식 따옴표 칸(칸 안 줄바꿈·탭, \"\" 이스케이프)", () => {
  const text = 'no\t"문항\r\n하나"\t"탭\t""포함"""\r\n1\t3\t4\r\n';
  assert.deepEqual(plain(parseTsv(text)), [
    ["no", "문항\r\n하나", '탭\t"포함"'],
    ["1", "3", "4"],
  ]);
});

test("parseTsv: 줄바꿈·탭이 없는 따옴표 값은 글자 그대로", () => {
  assert.deepEqual(plain(parseTsv('a\tb\n1\t"3"\n2\t"x')), [
    ["a", "b"],
    ["1", '"3"'],
    ["2", '"x'],
  ]);
});

test("parseTsv: 빈 입력", () => {
  assert.deepEqual(plain(parseTsv("")), []);
  assert.deepEqual(plain(parseTsv("\r\n\n")), []);
});

test("tally: 기본 집계, 첫 열은 집계하지 않음", () => {
  const text = [
    "응답번호\tQ1\tQ2\tQ3",
    "1\t5\t3\t",
    "2\t4\t \t모름",
    "3\t3\t6\t2",
    "4\t 4 \t\t",
  ].join("\r\n");
  const r = plain(tally(text));
  assert.equal(r.responseCount, 4);
  assert.deepEqual(r.questions, [
    { name: "Q1", valid: 4, average: "4.00", blank: 0, excluded: 0 },
    { name: "Q2", valid: 1, average: "3.00", blank: 2, excluded: 1 },
    { name: "Q3", valid: 1, average: "2.00", blank: 2, excluded: 1 },
  ]);
});

test("tally: 첫 열 값이 1~5여도 문항으로 세지 않음", () => {
  const r = plain(tally("번호\tQ1\n1\t2\n2\t4\n"));
  assert.deepEqual(r.questions.map((q) => q.name), ["Q1"]);
  assert.equal(r.questions[0].average, "3.00");
});

test("tally: 칸이 모자란 줄은 모자란 칸을 빈 응답으로", () => {
  const r = plain(tally("번호\tQ1\tQ2\tQ3\n1\t5\n2\n3\t1\t2\t3\n"));
  assert.equal(r.responseCount, 3);
  assert.deepEqual(r.questions, [
    { name: "Q1", valid: 2, average: "3.00", blank: 1, excluded: 0 },
    { name: "Q2", valid: 1, average: "2.00", blank: 2, excluded: 0 },
    { name: "Q3", valid: 1, average: "3.00", blank: 2, excluded: 0 },
  ]);
});

test("tally: 칸이 머리글보다 많으면 넘치는 칸은 무시", () => {
  const r = plain(tally("번호\tQ1\n1\t5\t9\tx\n"));
  assert.deepEqual(r.questions, [{ name: "Q1", valid: 1, average: "5.00", blank: 0, excluded: 0 }]);
});

test("tally: 유효 0이면 평균 -", () => {
  const r = plain(tally("번호\tQ1\n1\t\n2\tx\n"));
  assert.deepEqual(r.questions, [{ name: "Q1", valid: 0, average: "-", blank: 1, excluded: 1 }]);
});

test("tally: 머리글만 있으면 모두 0", () => {
  const r = plain(tally("번호\tQ1\tQ2\r\n"));
  assert.equal(r.responseCount, 0);
  assert.deepEqual(r.questions, [
    { name: "Q1", valid: 0, average: "-", blank: 0, excluded: 0 },
    { name: "Q2", valid: 0, average: "-", blank: 0, excluded: 0 },
  ]);
});

test("tally: 빈 머리글 이름은 '열 N', 이름 앞뒤 공백은 지움", () => {
  const r = plain(tally("번호\t  만족도 \t\t \n1\t1\t2\t3\n"));
  assert.deepEqual(r.questions.map((q) => q.name), ["만족도", "열 3", "열 4"]);
});

test("tally: 빈 입력과 응답번호 열만 있는 입력", () => {
  assert.deepEqual(plain(tally("")), { questions: [], responseCount: 0 });
  assert.deepEqual(plain(tally("번호\n1\n2\n")), { questions: [], responseCount: 2 });
});

test("tally: 따옴표로 감싼 여러 줄 머리글도 한 문항", () => {
  const r = plain(tally('번호\t"서비스에\n만족하십니까?"\tQ2\n1\t4\t5\n2\t5\t\n'));
  assert.equal(r.responseCount, 2);
  assert.deepEqual(r.questions, [
    { name: "서비스에\n만족하십니까?", valid: 2, average: "4.50", blank: 0, excluded: 0 },
    { name: "Q2", valid: 1, average: "5.00", blank: 1, excluded: 0 },
  ]);
});

test("tally: 많은 응답에서도 평균이 정확", () => {
  // 1이 1개, 2가 199개: 합 399, 수 200 → 1.995 → 2.00
  const lines = ["번호\tQ1", "1\t1"];
  for (let i = 0; i < 199; i++) lines.push(`${i + 2}\t2`);
  const r = plain(tally(lines.join("\n")));
  assert.deepEqual(r.questions[0], { name: "Q1", valid: 200, average: "2.00", blank: 0, excluded: 0 });
});
