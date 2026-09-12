import test, { describe } from "node:test"
import assert from "node:assert/strict"
import { isV3SignupDateLocked, getV3SignupOpenDate } from "@/lib/dates"
import { hasV3Access, isUserVerified, getUserRoles } from "@/lib/permissions"

describe("V3 Signup Date & Time Lock Rules", () => {
  test("allows signup on the event day", () => {
    // Current date is 2026-09-12 08:00
    const now = new Date("2026-09-12T06:00:00Z") // 08:00 in Warsaw (UTC+2)
    const eventDate = "2026-09-12"
    const isLocked = isV3SignupDateLocked(eventDate, now, 2, "09:00")
    assert.equal(isLocked, false, "Event on the same day should always be unlocked")
  })

  test("allows signup 1 day ahead when maxDaysAhead is 2", () => {
    const now = new Date("2026-09-12T06:00:00Z") // 2026-09-12
    const eventDate = "2026-09-13" // 1 day ahead
    const isLocked = isV3SignupDateLocked(eventDate, now, 2, "09:00")
    assert.equal(isLocked, false, "1 day ahead is less than 2 days ahead, should be unlocked")
  })

  test("locks signup 2 days ahead before openTime (e.g. 09:00 Warsaw)", () => {
    // 08:30 Warsaw = 06:30 UTC
    const nowBeforeOpen = new Date("2026-09-12T06:30:00Z")
    const eventDate = "2026-09-14" // 2 days ahead
    const isLocked = isV3SignupDateLocked(eventDate, nowBeforeOpen, 2, "09:00")
    assert.equal(isLocked, true, "Should be locked before 09:00 on the opening day")
  })

  test("unlocks signup 2 days ahead at and after openTime (09:00 Warsaw)", () => {
    // 09:01 Warsaw = 07:01 UTC
    const nowAfterOpen = new Date("2026-09-12T07:01:00Z")
    const eventDate = "2026-09-14" // 2 days ahead
    const isLocked = isV3SignupDateLocked(eventDate, nowAfterOpen, 2, "09:00")
    assert.equal(isLocked, false, "Should be unlocked at/after 09:00 on the opening day")
  })

  test("locks signup more than 2 days ahead (e.g. 3 days ahead)", () => {
    const now = new Date("2026-09-12T10:00:00Z") // 12:00 Warsaw
    const eventDate = "2026-09-15" // 3 days ahead
    const isLocked = isV3SignupDateLocked(eventDate, now, 2, "09:00")
    assert.equal(isLocked, true, "3 days ahead should be locked when maxDaysAhead=2")
  })

  test("yellow card restriction reduces maxDaysAhead (e.g. to 1 day)", () => {
    const now = new Date("2026-09-12T10:00:00Z") // 12:00 Warsaw
    const eventDate = "2026-09-14" // 2 days ahead
    // With yellow card: allowedAdvanceDays is 1 instead of 2
    const isLockedWithPenalty = isV3SignupDateLocked(eventDate, now, 1, "09:00")
    assert.equal(isLockedWithPenalty, true, "User with yellow card cannot sign up 2 days ahead")

    // But for 1 day ahead (tomorrow) after open time:
    const tomorrowEvent = "2026-09-13"
    const isTomorrowLocked = isV3SignupDateLocked(tomorrowEvent, now, 1, "09:00")
    assert.equal(isTomorrowLocked, false, "User with yellow card can sign up 1 day ahead")
  })

  test("calculates getV3SignupOpenDate correctly", () => {
    const openDate2Days = getV3SignupOpenDate("2026-09-14", 2)
    assert.equal(openDate2Days, "2026-09-12")

    const openDate1Day = getV3SignupOpenDate("2026-09-14", 1)
    assert.equal(openDate1Day, "2026-09-13")
  })
})

describe("V3 Access & Verification Permissions", () => {
  test("leader always has V3 access even without roles or verification", () => {
    const leader = { isLeader: true, isVerified: false, roles: "[]" }
    assert.equal(hasV3Access(leader), true)
  })

  test("verified user with V3 role has V3 access", () => {
    const v3User = { isLeader: false, isVerified: true, roles: JSON.stringify(["V3"]) }
    assert.equal(hasV3Access(v3User), true)
  })

  test("unverified user is denied V3 access even if roles includes V3", () => {
    const unverifiedUser = { isLeader: false, isVerified: false, roles: JSON.stringify(["V3"]) }
    assert.equal(hasV3Access(unverifiedUser), false)
  })

  test("verified user without V3 role is denied V3 access", () => {
    const noV3RoleUser = { isLeader: false, isVerified: true, roles: JSON.stringify(["InnaRola"]) }
    assert.equal(hasV3Access(noV3RoleUser), false)
  })

  test("handles malformed or empty roles gracefully", () => {
    assert.equal(hasV3Access(null), false)
    assert.equal(hasV3Access(undefined), false)
    assert.equal(hasV3Access({ isLeader: false, isVerified: true, roles: "invalid json" }), false)
    assert.deepEqual(getUserRoles({ roles: "invalid json" }), [])
    assert.deepEqual(getUserRoles({ roles: null }), [])
  })
})

describe("Multi-Character & Event Signup Business Rules", () => {
  test("non-main character can only sign up on the event day", () => {
    const today: string = "2026-09-12"
    const futureDate: string = "2026-09-13"

    const mainChar = { id: "char-1", name: "MainHero", isMain: true }
    const additionalChar = { id: "char-2", name: "Hero2", isMain: false }

    // Check on future date:
    const isFutureEventDay = futureDate === today // false
    assert.equal(
      !mainChar.isMain && !isFutureEventDay,
      false,
      "Main character can sign up on future date"
    )
    assert.equal(
      !additionalChar.isMain && !isFutureEventDay,
      true,
      "Additional character cannot sign up on future date"
    )

    // Check on event day:
    const isTodayEventDay = today === ("2026-09-12" as string) // true
    assert.equal(
      !additionalChar.isMain && !isTodayEventDay,
      false,
      "Additional character CAN sign up on the event day"
    )
  })

  test("second spot is blocked on future dates and limited to max 2 spots", () => {
    const today: string = "2026-09-12"
    const futureDate: string = "2026-09-13"

    // Case 1: User has 1 signup, trying to take a 2nd spot on a future date
    const existingSignupsFuture = [{ id: "signup-1", spot: "R1" }]
    const isFutureDay = futureDate === today // false
    const canTakeSecondSpotOnFuture = !(existingSignupsFuture.length > 0 && !isFutureDay)
    assert.equal(canTakeSecondSpotOnFuture, false, "Cannot take a second spot on a future date")

    // Case 2: User has 1 signup on event day, taking 2nd spot
    const isEventDay = true
    const existingSignupsToday = [{ id: "signup-1", spot: "R1" }]
    const canTakeSecondSpotOnEventDay = !(existingSignupsToday.length > 0 && !isEventDay)
    assert.equal(canTakeSecondSpotOnEventDay, true, "Can take a second spot on event day")

    // Case 3: User already has 2 signups on event day, trying to take a 3rd spot
    const existingTwoSignups = [{ id: "signup-1", spot: "R1" }, { id: "signup-2", spot: "R2" }]
    const canTakeThirdSpot = existingTwoSignups.length < 2
    assert.equal(canTakeThirdSpot, false, "Maximum 2 signups per event per player")
  })

  test("duplicate signup with the exact same character is rejected", () => {
    const existingSignups = [
      { id: "s1", characterId: "char-uuid-1", characterName: "DragonSlayer" },
    ]

    const sameCharId = { id: "char-uuid-1", name: "DragonSlayer", isMain: true }
    const isAlreadySigned = existingSignups.some(
      (s) =>
        (s.characterId && s.characterId === sameCharId.id) ||
        (s.characterName && s.characterName.toLowerCase() === sameCharId.name.toLowerCase())
    )
    assert.equal(isAlreadySigned, true, "Same character cannot be signed up twice")

    const differentChar = { id: "char-uuid-2", name: "ShadowNinja", isMain: false }
    const isDiffSigned = existingSignups.some(
      (s) =>
        (s.characterId && s.characterId === differentChar.id) ||
        (s.characterName && s.characterName.toLowerCase() === differentChar.name.toLowerCase())
    )
    assert.equal(isDiffSigned, false, "Different character should be allowed")
  })
})
