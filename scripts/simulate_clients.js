// simulate_clients.js
// Node.js 18+ (Node 22 OK) — uses native fetch, no dependencies needed

// Configuration
const TARGET_URL = 'http://localhost:3000/api/chat';
const NUM_CLIENTS = 20;

async function simulateClients() {
  console.log(
    `Starting simulation: ${NUM_CLIENTS} concurrent clients targeting ${TARGET_URL}...`
  );

  const requests = [];
  const startTime = Date.now();

  for (let i = 1; i <= NUM_CLIENTS; i++) {
    const clientId = `client-${i}`;
    const fakeIp = `192.168.0.${i}`; // Unique IP per client

    const payload = {
      prompt: `Hello from ${clientId}!`,
      context: { url: '/simulation' }
    };

    const requestPromise = fetch(TARGET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': fakeIp,
        'User-Agent': `SimulationScript/${clientId}`
      },
      body: JSON.stringify(payload)
    })
      .then(async (res) => {
        let data;
        try {
          data = await res.json();
        } catch {
          data = { error: 'Invalid JSON response' };
        }

        return {
          id: clientId,
          status: res.status,
          data,
          time: Date.now()
        };
      })
      .catch((err) => {
        return {
          id: clientId,
          status: 'ERROR',
          error: err.message
        };
      });

    requests.push(requestPromise);
  }

  // Fire all requests concurrently
  const results = await Promise.all(requests);
  const endTime = Date.now();

  // Summary
  console.log('\n--- Simulation Results ---');
  let successCount = 0;
  let failCount = 0;

  for (const r of results) {
    if (r.status === 200) {
      successCount++;
      console.log(
        `[${r.id}] ✅ Success: ${r.data?.reply?.substring(0, 50) ?? 'OK'}...`
      );
    } else {
      failCount++;
      console.log(
        `[${r.id}] ❌ Failed (${r.status}): ${JSON.stringify(r.data || r.error)}`
      );
    }
  }

  console.log('\n--- Final Stats ---');
  console.log(`Total Requests: ${NUM_CLIENTS}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total Time: ${(endTime - startTime) / 1000}s`);
}

// Sanity check (optional)
if (typeof fetch !== 'function') {
  throw new Error(
    "Global fetch is not available. Please use Node.js v18+."
  );
}

simulateClients();
