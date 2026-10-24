import test, { describe } from "node:test"
import assert from "node:assert/strict"
import { diffEntries } from "@/lib/progress"
import { eqLines, skillLines } from "@/lib/progress-fields"

describe("diffEntries", () => {
  test("marks changed, new, same and removed entries by name", () => {
    const rows = diffEntries("Skill 1: P\nskill 2: G8\nSkill 4: M1\n\n", "Skill 1: P\nSkill 2: G5\nSkill 3: M10")
    assert.deepEqual(
      rows.map((r) => [r.name, r.status, r.before ?? null, r.value]),
      [
        ["Skill 1", "same", null, "P"],
        ["skill 2", "changed", "G5", "G8"],
        ["Skill 4", "new", null, "M1"],
        ["Skill 3", "removed", "M10", ""],
      ]
    )
  })

  test("first report has nothing to compare with", () => {
    assert.ok(diffEntries("Broń: Miecz +9\nTarcza", undefined).every((r) => r.status === "same"))
  })

  test("value may contain colons", () => {
    assert.equal(diffEntries("Czas: 12:30", undefined)[0].value, "12:30")
  })
})

describe("skillLines", () => {
  test("lists the class skills in order and keeps known levels", () => {
    assert.equal(
      skillLines("Wojownik — Body", "aura miecza: P\nInny skill: G1", { name: "Szarża", value: "M3" }),
      "Aura Miecza: P\nBerserk: \nSzarża: M3\nWir Miecza: \nTrzystronne Cięcie: "
    )
  })

  test("unknown class has no skills", () => {
    assert.equal(skillLines("Wojownik (Ciało)", "Aura Miecza: P"), "")
  })
})

describe("eqLines", () => {
  test("always lists every EQ field in section order", () => {
    assert.equal(
      eqLines("HP: 40000\nBroń: Miecz +9\nwb/metin hp: 50000", { name: "ABS Magia", value: "12%" }),
      "ABS Miecze: \nABS Dwuręka: \nABS Sztylety: \nABS Strzały: \nABS Wachlarze: \nABS Dzwony: \nABS Magia: 12%\nSilny przeciwko ludziom: \nHP: 40000\n" +
        "Dunga Mistyki: \nDunga Zwierzęta: \nDunga HP: \nDunga Fala mocy: \nWB/Metin Diabły: \nWB/Metin HP: 50000\n" +
        ["Miecze", "Dwuręka", "Sztylety", "Strzały", "Wachlarze", "Dzwony", "Magia"].map((t) => `WB/Metin ABS ${t}: `).join("\n")
    )
  })
})
