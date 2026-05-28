import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateDqe, defaultInput, DqeInput } from "./scoring";

const cloneInput = (input: DqeInput) => JSON.parse(JSON.stringify(input)) as DqeInput;

describe("calculateDqe", () => {
  it("matches the workbook baseline score and status", () => {
    const result = calculateDqe(defaultInput);

    assert.equal(result.selectedServices, 8);
    assert.equal(result.capabilityScore, 4.17);
    assert.equal(result.commercialRiskScore, 3.3);
    assert.equal(result.weightedRiskScore, 2.58);
    assert.equal(result.status, "amber");
    assert.equal(result.statusLabel, "Proceed With Caution");
  });

  it("raises explicit explanations when deadline and team availability are high-risk", () => {
    const input = cloneInput(defaultInput);
    input.risk.deadlineFeasibility = 5;
    input.risk.teamAvailability = 4;

    const result = calculateDqe(input);

    assert.ok(result.weightedRiskScore > 2.58);
    assert.ok(result.explanations.some((explanation) => explanation.includes("deadline feasibility")));
    assert.ok(result.explanations.some((explanation) => explanation.includes("resource & team availability")));
  });

  it("increases risk when commercial qualification is weak", () => {
    const strong = cloneInput(defaultInput);
    strong.overview.budgetConfirmed = "Yes";
    strong.overview.decisionMakerIdentified = "Yes";
    strong.overview.fundingSourceKnown = "Yes";
    strong.overview.marginConfidence = "High";
    strong.overview.winProbability = "High";
    strong.overview.partnerDependency = "Low";

    const weak = cloneInput(defaultInput);
    weak.overview.budgetConfirmed = "No";
    weak.overview.decisionMakerIdentified = "No";
    weak.overview.fundingSourceKnown = "No";
    weak.overview.marginConfidence = "Low";
    weak.overview.winProbability = "Low";
    weak.overview.partnerDependency = "High";

    const strongResult = calculateDqe(strong);
    const weakResult = calculateDqe(weak);

    assert.ok(weakResult.commercialRiskScore > strongResult.commercialRiskScore);
    assert.ok(weakResult.weightedRiskScore > strongResult.weightedRiskScore);
    assert.ok(weakResult.recommendation.includes("Commercial gates"));
  });

  it("honors editable risk weights", () => {
    const balanced = cloneInput(defaultInput);
    const timeHeavy = cloneInput(defaultInput);
    timeHeavy.risk.deadlineFeasibility = 5;
    timeHeavy.risk.teamAvailability = 5;
    timeHeavy.weights = { development: 0.1, time: 0.8, operations: 0.1 };

    const balancedResult = calculateDqe(balanced);
    const timeHeavyResult = calculateDqe(timeHeavy);

    assert.ok(timeHeavyResult.weightedRiskScore > balancedResult.weightedRiskScore);
    assert.ok(timeHeavyResult.explanations.some((explanation) => explanation.includes("Time Risk has the strongest weighting")));
  });

  it("moves low capability into the recommendation risk narrative", () => {
    const input = cloneInput(defaultInput);
    Object.keys(input.capability).forEach((serviceId) => {
      input.capability[serviceId] = { skills: 1, tools: 1, experience: 1 };
    });

    const result = calculateDqe(input);

    assert.equal(result.capabilityScore, 1);
    assert.ok(result.flags.some((flag) => flag.includes("capability score is too low")));
    assert.ok(result.explanations.some((explanation) => explanation.includes("Capability alignment is pulling")));
  });
});
