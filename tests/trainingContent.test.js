import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTrainingSteps,
  collectQuizAnswers,
  findUnansweredQuestions,
  getStatusBadgeClass,
  pickActiveResultId,
} from "../src/pages/Training/trainingContentUtils.js";

const assignment = (overrides = {}) => ({
  result_id: 361,
  status: "training_sent",
  score: null,
  passed: false,
  training_sent_at: "2026-06-22T17:29:02.611Z",
  training_completed_at: null,
  test_completed_at: null,
  test: { available: true },
  progress: { training_completed: false, test_sent: false, test_completed: false },
  ...overrides,
});

const stepState = (steps) => steps.map((step) => (step.done ? "done" : step.current ? "current" : "-"));

test("the e-mail link's assignment is highlighted only when it belongs to the responsible", () => {
  const portal = { active_result_id: 287, assignments: [{ result_id: 361 }, { result_id: 287 }, { result_id: 277 }] };
  assert.equal(pickActiveResultId(portal, "277"), "277");
  assert.equal(pickActiveResultId(portal, "999"), "287", "unknown id: the API's suggestion");
  assert.equal(pickActiveResultId({ ...portal, active_result_id: null }, null), "361", "else the first assignment");
  assert.equal(pickActiveResultId({ assignments: [] }, "361"), null);
});

test("the four steps follow the assignment from training to outcome", () => {
  assert.deepEqual(stepState(buildTrainingSteps(assignment())), ["done", "-", "-", "-"]);

  const unlocked = buildTrainingSteps(
    assignment({ progress: { training_completed: true, test_sent: true, test_completed: false } })
  );
  assert.deepEqual(stepState(unlocked), ["done", "done", "current", "-"]);
  assert.equal(unlocked[1].copy, "Completed Not available", "completed without a recorded date, as in production");
  assert.equal(unlocked[2].copy, "Questionnaire is unlocked and ready.");

  const passed = buildTrainingSteps(
    assignment({
      score: 85,
      passed: true,
      test_completed_at: "2026-06-25T09:00:00.000Z",
      progress: { training_completed: true, test_sent: true, test_completed: true },
    })
  );
  assert.deepEqual(stepState(passed), ["done", "done", "done", "done"]);
  assert.equal(passed[3].copy, "Passed at 85%");
  assert.match(passed[0].copy, /^Sent /);

  const noTest = buildTrainingSteps(assignment({ test: { available: false } }));
  assert.equal(noTest[2].copy, "No questionnaire is linked to this training.");
});

test("submitted answers are trimmed and every question gets an entry", () => {
  const questions = [
    { id: "1", type: "single" },
    { id: "2", type: "multi" },
    { id: "3", type: "text" },
    { id: "4", type: "single" },
  ];
  const submitted = collectQuizAnswers(questions, { 1: ["B"], 2: ["A", "C"], 3: ["  stock  "], 9: ["X"] });
  assert.deepEqual(submitted, { 1: ["B"], 2: ["A", "C"], 3: ["stock"], 4: [] });
  assert.deepEqual(
    findUnansweredQuestions(questions, submitted).map((question) => question.id),
    ["4"]
  );
  assert.deepEqual(
    findUnansweredQuestions(questions, collectQuizAnswers(questions, { 1: ["B"], 2: ["A"], 3: ["   "], 4: ["D"] })).map(
      (question) => question.id
    ),
    ["3"],
    "a blank text answer is still missing"
  );
  assert.deepEqual(collectQuizAnswers(questions, undefined), { 1: [], 2: [], 3: [], 4: [] });
});

test("an unknown status still gets a neutral chip", () => {
  assert.match(getStatusBadgeClass("training_sent"), /text-blue-700/);
  assert.match(getStatusBadgeClass("something_new"), /text-slate-600/);
});
