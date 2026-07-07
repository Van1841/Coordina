// ============================================================
// src/demo/seed.js
// `npm run demo` runs migrate --fresh then this file. Populates
// realistic organizations, resources (inventory/shelter/
// volunteer/logistics), and a spread of incidents at different
// ages/severities so the dashboard and Slack commands have
// something compelling to show immediately — no manual data
// entry needed before recording a demo video.
// ============================================================
import 'dotenv/config';
import { upsertOrganization, upsertResource, createIncident, updateIncident } from '../db/queries.js';
import { scoreIncident } from '../scoring/priorityEngine.js';
import makeLogger from '../utils/logger.js';

const log = makeLogger('demo-seed');

const ORGS = [
  { id: 'ngo_relief_trust', name: 'NGO Relief Trust', type: 'ngo', latitude: 22.7196, longitude: 75.8577 }, // Indore
  { id: 'city_general_hospital', name: 'City General Hospital', type: 'hospital', latitude: 22.7264, longitude: 75.8792 },
  { id: 'volunteer_corps', name: 'Volunteer Corps', type: 'volunteer', latitude: 22.7059, longitude: 75.8827 },
  { id: 'regional_food_bank', name: 'Regional Food Bank', type: 'foodbank', latitude: 22.6996, longitude: 75.8365 },
  { id: 'district_gov_relief_office', name: 'District Relief Office', type: 'government', latitude: 22.7350, longitude: 75.8900 },
];

const RESOURCES = [
  // inventory
  { organizationId: 'city_general_hospital', category: 'inventory', label: 'insulin', quantity: 18, capacity: 200, unit: 'vials' },
  { organizationId: 'city_general_hospital', category: 'inventory', label: 'iv_fluids', quantity: 140, capacity: 300, unit: 'bags' },
  { organizationId: 'regional_food_bank', category: 'inventory', label: 'dry_rations', quantity: 620, capacity: 1000, unit: 'kits' },
  { organizationId: 'regional_food_bank', category: 'inventory', label: 'drinking_water', quantity: 90, capacity: 800, unit: 'crates' },
  { organizationId: 'ngo_relief_trust', category: 'inventory', label: 'blankets', quantity: 45, capacity: 500, unit: 'units' },
  { organizationId: 'ngo_relief_trust', category: 'inventory', label: 'first_aid_kits', quantity: 210, capacity: 250, unit: 'kits' },

  // shelter
  { organizationId: 'ngo_relief_trust', category: 'shelter', label: 'community_hall_shelter', quantity: 180, capacity: 220, unit: 'beds' },
  { organizationId: 'district_gov_relief_office', category: 'shelter', label: 'school_relief_camp', quantity: 60, capacity: 400, unit: 'beds' },

  // volunteer
  { organizationId: 'volunteer_corps', category: 'volunteer', label: 'general_volunteers', quantity: 12, capacity: 80, unit: 'people' },
  { organizationId: 'volunteer_corps', category: 'volunteer', label: 'medical_trained', quantity: 4, capacity: 20, unit: 'people' },

  // logistics
  { organizationId: 'volunteer_corps', category: 'logistics', label: 'delivery_vans', quantity: 3, capacity: 6, unit: 'vehicles' },
  { organizationId: 'district_gov_relief_office', category: 'logistics', label: 'relief_trucks', quantity: 2, capacity: 5, unit: 'vehicles' },
];

// hoursAgo lets us backdate incidents so `timeWaiting` scoring and
// escalation logic have something realistic to demonstrate.
const INCIDENTS = [
  {
    organizationId: 'city_general_hospital',
    kind: 'urgent',
    category: 'medical',
    summary: 'Insulin stock critically low, running out within hours',
    peopleAffected: 34,
    hoursAgo: 7.5,
    rawText: 'We are running out of insulin urgently, only a few vials left for 34 registered diabetic patients',
  },
  {
    organizationId: 'ngo_relief_trust',
    kind: 'need',
    category: 'shelter',
    summary: 'Flood-displaced families need shelter beds tonight',
    peopleAffected: 120,
    hoursAgo: 3,
    rawText: 'We have about 120 flood-displaced people who need shelter beds tonight, our hall is nearly full',
  },
  {
    organizationId: 'regional_food_bank',
    kind: 'need',
    category: 'food',
    summary: 'Drinking water supplies almost finished at food bank',
    peopleAffected: 300,
    hoursAgo: 1.2,
    rawText: 'Food stocks almost finished, especially drinking water crates, serving around 300 people daily',
  },
  {
    organizationId: 'ngo_relief_trust',
    kind: 'offer',
    category: 'logistics',
    summary: 'Volunteer Corps offering two delivery vans for the evening',
    peopleAffected: 0,
    hoursAgo: 0.5,
    rawText: 'We can provide two delivery vans this evening if any organization needs transport help',
  },
  {
    organizationId: 'district_gov_relief_office',
    kind: 'urgent',
    category: 'medical',
    summary: 'Multiple injuries reported, ambulance and medical volunteers needed',
    peopleAffected: 9,
    hoursAgo: 0.3,
    rawText: 'Urgent, multiple injuries reported near the relief camp, need ambulance and medical volunteers immediately',
  },
  {
    organizationId: 'regional_food_bank',
    kind: 'need',
    category: 'food',
    summary: 'Additional ration kits requested for new arrivals',
    peopleAffected: 80,
    hoursAgo: 9,
    rawText: 'We now need 200 dry ration kits, more families arrived than expected this morning', // demonstrates merge-on-restated-need
  },
];

async function seedOrganizations() {
  for (const org of ORGS) {
    await upsertOrganization({ ...org, metadata: { seeded: true } });
  }
  log.info(`seeded ${ORGS.length} organizations`);
}

async function seedResources() {
  for (const r of RESOURCES) {
    await upsertResource(r);
  }
  log.info(`seeded ${RESOURCES.length} resources`);
}

async function backdate(incidentId, hoursAgo) {
  const { pool } = await import('../db/pool.js');
  const createdAt = new Date(Date.now() - hoursAgo * 3600 * 1000);
  await pool.query('UPDATE incidents SET created_at = ? WHERE id = ?', [createdAt, incidentId]);
}

async function seedIncidents() {
  const orgIds = ORGS.map((o) => o.id);
  let lastFoodIncidentId = null;

  for (const inc of INCIDENTS) {
    const id = await createIncident({
      organizationId: inc.organizationId,
      kind: inc.kind,
      category: inc.category,
      summary: inc.summary,
      peopleAffected: inc.peopleAffected,
      sourceChannel: 'general',
      rawText: inc.rawText,
    });
    await backdate(id, inc.hoursAgo);

    // Demonstrate the merge-on-restated-need behaviour explicitly
    // in seed data: the second food-bank "need" incident represents
    // what WOULD be a duplicate in production (RTS handles this live
    // for real Slack messages) — here we simulate the outcome by
    // merging it into the earlier food incident so the dashboard
    // shows the pattern without requiring a live Slack message.
    if (inc.category === 'food' && lastFoodIncidentId && inc.rawText.includes('now need')) {
      await updateIncident(lastFoodIncidentId, {
        peopleAffected: Math.max(inc.peopleAffected, 300),
        summary: 'Drinking water and ration shortage — updated with latest arrivals',
      });
      await updateIncident(id, { status: 'merged', mergedIntoId: lastFoodIncidentId });
      log.info(`demo: merged incident #${id} into #${lastFoodIncidentId} to illustrate duplicate-handling`);
      continue;
    }
    if (inc.category === 'food') lastFoodIncidentId = id;

    const { getIncident } = await import('../db/queries.js');
    const incident = await getIncident(id);
    const { score, breakdown } = await scoreIncident(incident, { candidateOrgIds: orgIds.filter((o) => o !== inc.organizationId) });
    await updateIncident(id, { priorityScore: score, scoreBreakdown: breakdown });
    log.info(`incident #${id} "${inc.summary}" scored ${score}`);
  }
}

async function main() {
  log.info('Seeding Coordina demo data...');
  await seedOrganizations();
  await seedResources();
  await seedIncidents();
  log.info('Demo seed complete. Start the app with `npm start` and the dashboard with `npm run dashboard`.');
  process.exit(0);
}

main().catch((err) => {
  log.error('demo seed failed:', err);
  process.exit(1);
});
