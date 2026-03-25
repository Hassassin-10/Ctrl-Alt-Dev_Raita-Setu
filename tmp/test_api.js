const API_KEY = "579b464db66ec23bdd000001bcc1f5185a534ad347978022f0866bc4";
const RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";

async function test(crop) {
    const url = `https://api.data.gov.in/resource/${RESOURCE_ID}?api-key=${API_KEY}&format=json&limit=1&filters[commodity.keyword]=${crop}`;
    console.log(`Checking: ${crop}`);
    const res = await fetch(url);
    const data = await res.json();
    console.log(`- ${crop}: ${data.records && data.records.length > 0 ? "YES" : "NO"}`);
}

(async () => {
    await test("Rice");
    await test("Wheat");
    await test("Onion");
    await test("Corn");
    await test("Maize");
})();
