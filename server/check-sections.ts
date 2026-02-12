import * as cheerio from "cheerio";

const BASE_URL = "https://advaitasharada.sringeri.net";

async function checkSections() {
  const url = `${BASE_URL}/display/bhashyaVyakhya/Isha/devanagari?vyakhya=AIS`;
  console.log(`Fetching: ${url}`);
  const response = await fetch(url);
  const html = await response.text();
  const ch = cheerio.load(html);

  const vyakhyaParaText = ch(".vyakhyaPara").text().trim();
  const sectionIds = vyakhyaParaText.split(";").map(s => s.trim()).filter(Boolean);
  console.log(`\nAll vyakhya section IDs (${sectionIds.length}):`);
  for (const id of sectionIds) {
    const isISection = /_I\d+$/.test(id);
    console.log(`  ${id} ${isISection ? " <-- I-SECTION (should skip)" : ""}`);
  }

  // Check verse 1 bhashya sections
  const verse1 = ch("#IS_C01_V01");
  if (verse1.length) {
    console.log("\n--- Verse 1 structure ---");
    verse1.find(".bhashya").each((i, el) => {
      const id = ch(el).attr("id") || "no-id";
      const text = ch(el).text().trim().substring(0, 80);
      console.log(`  bhashya[${i}] id=${id}: "${text}..."`);
    });
    verse1.find(".leading_bhashya").each((i, el) => {
      const id = ch(el).attr("id") || "no-id";
      const text = ch(el).text().trim().substring(0, 80);
      console.log(`  leading_bhashya[${i}] id=${id}: "${text}..."`);
    });
  }

  // Now check what teeka comes from the B-sections for verse 1
  const v1Bsections = sectionIds.filter(id => id.includes("V01") && !/_I\d+$/.test(id));
  const v1Isections = sectionIds.filter(id => id.includes("V01") && /_I\d+$/.test(id));
  console.log(`\nVerse 1 B-sections: ${v1Bsections.join(", ")}`);
  console.log(`Verse 1 I-sections: ${v1Isections.join(", ")}`);

  for (const sid of v1Bsections) {
    const teekaUrl = `${BASE_URL}/display/getVyakhya/AIS/${sid}/devanagari`;
    const tResp = await fetch(teekaUrl);
    const tHtml = await tResp.text();
    const tCh = cheerio.load(tHtml);
    const firstDesc = tCh(".VyakhyaDescriptor").first();
    const firstText = firstDesc.text().trim().substring(0, 120);
    console.log(`  B-section ${sid} teeka starts: "${firstText}..."`);
  }

  for (const sid of v1Isections) {
    const teekaUrl = `${BASE_URL}/display/getVyakhya/AIS/${sid}/devanagari`;
    const tResp = await fetch(teekaUrl);
    const tHtml = await tResp.text();
    const tCh = cheerio.load(tHtml);
    const firstDesc = tCh(".VyakhyaDescriptor").first();
    const firstText = firstDesc.text().trim().substring(0, 120);
    console.log(`  I-section ${sid} teeka starts: "${firstText}..."`);
  }
}

checkSections().catch(console.error);
