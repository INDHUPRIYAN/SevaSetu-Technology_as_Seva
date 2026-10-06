// Fixed _id values used by both seed scripts, so the seeded commitment in seva_core and the
// seeded diary entries in seva_reflect point to the same commitmentId.
// Neither person changes a value here without telling the other.
module.exports = {
  users: {
    newVolunteer:    '650000000000000000000001',   // used live in the demo
    seededVolunteer: '650000000000000000000002',   // already at week 2 of 4
    circleMember:    '650000000000000000000003',
    coordinator:     '650000000000000000000004',
    otherVolunteer:  '650000000000000000000005',   // not in the circle (tests that outsiders cannot cover)
  },
  orgs: {
    govtSchool: '650000000000000000000011',        // Government School, Kanchipuram (verified, 3 km)
    org2:       '650000000000000000000012',
    org3:       '650000000000000000000013',
    college:    '650000000000000000000014',        // offers resources (Resource Connect)
  },
  needs: {
    englishReading: '650000000000000000000021',    // the seeded volunteer's need (filled)
    need2:          '650000000000000000000022',
    need3:          '650000000000000000000023',
    need4:          '650000000000000000000024',
    need5:          '650000000000000000000025',
    need6:          '650000000000000000000026',
    need7:          '650000000000000000000027',
  },
  visits: {
    seeded: '650000000000000000000031',
  },
  commitments: {
    seeded: '650000000000000000000041',            // reflect entries use this as commitmentId
  },
  resources: {
    collegeTablets:  '650000000000000000000061',
    libraryBooks:    '650000000000000000000062',
    eldersChairs:    '650000000000000000000063',
    schoolTablets:   '650000000000000000000064',     // "We lack 10 tablets" — matches collegeTablets
  },
  circles: {
    main: '650000000000000000000051',
  },
};
