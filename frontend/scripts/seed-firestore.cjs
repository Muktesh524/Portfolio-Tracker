/**
 * seed-firestore.js — Populate Firestore with Stocks & Mutual Funds
 * ──────────────────────────────────────────────────────────────────
 * Usage:
 *   1. Download your Firebase service account key JSON from:
 *      Firebase Console → Project Settings → Service Accounts → Generate New Private Key
 *   2. Save it as: scripts/serviceAccountKey.json
 *   3. Run: node scripts/seed-firestore.js
 *
 * This script writes to two collections: "stocks" and "mutual_funds"
 * Each document includes a "search_name" field (lowercase) for prefix search.
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// ── Initialize Firebase Admin ────────────────────────────────────────────────

const serviceAccount = require("./serviceAccountKey.json");

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

// ── Stock Data (NIFTY 50 + Popular Mid/Large Caps) ───────────────────────────

const STOCKS = [
  { symbol: "RELIANCE",    name: "Reliance Industries Ltd",         exchange: "NSE", sector: "Energy" },
  { symbol: "TCS",         name: "Tata Consultancy Services Ltd",   exchange: "NSE", sector: "IT" },
  { symbol: "HDFCBANK",    name: "HDFC Bank Ltd",                   exchange: "NSE", sector: "Banking" },
  { symbol: "INFY",        name: "Infosys Ltd",                     exchange: "NSE", sector: "IT" },
  { symbol: "ICICIBANK",   name: "ICICI Bank Ltd",                  exchange: "NSE", sector: "Banking" },
  { symbol: "HINDUNILVR",  name: "Hindustan Unilever Ltd",          exchange: "NSE", sector: "FMCG" },
  { symbol: "ITC",         name: "ITC Ltd",                         exchange: "NSE", sector: "FMCG" },
  { symbol: "SBIN",        name: "State Bank of India",             exchange: "NSE", sector: "Banking" },
  { symbol: "BHARTIARTL",  name: "Bharti Airtel Ltd",               exchange: "NSE", sector: "Telecom" },
  { symbol: "KOTAKBANK",   name: "Kotak Mahindra Bank Ltd",         exchange: "NSE", sector: "Banking" },
  { symbol: "BAJFINANCE",  name: "Bajaj Finance Ltd",               exchange: "NSE", sector: "Finance" },
  { symbol: "LT",          name: "Larsen & Toubro Ltd",             exchange: "NSE", sector: "Infrastructure" },
  { symbol: "HCLTECH",     name: "HCL Technologies Ltd",           exchange: "NSE", sector: "IT" },
  { symbol: "ASIANPAINT",  name: "Asian Paints Ltd",                exchange: "NSE", sector: "Consumer" },
  { symbol: "AXISBANK",    name: "Axis Bank Ltd",                   exchange: "NSE", sector: "Banking" },
  { symbol: "MARUTI",      name: "Maruti Suzuki India Ltd",         exchange: "NSE", sector: "Auto" },
  { symbol: "SUNPHARMA",   name: "Sun Pharmaceutical Industries",   exchange: "NSE", sector: "Pharma" },
  { symbol: "TITAN",       name: "Titan Company Ltd",               exchange: "NSE", sector: "Consumer" },
  { symbol: "ULTRACEMCO",  name: "UltraTech Cement Ltd",            exchange: "NSE", sector: "Cement" },
  { symbol: "WIPRO",       name: "Wipro Ltd",                       exchange: "NSE", sector: "IT" },
  { symbol: "BAJAJFINSV",  name: "Bajaj Finserv Ltd",               exchange: "NSE", sector: "Finance" },
  { symbol: "NESTLEIND",   name: "Nestle India Ltd",                exchange: "NSE", sector: "FMCG" },
  { symbol: "TATAMOTORS",  name: "Tata Motors Ltd",                 exchange: "NSE", sector: "Auto" },
  { symbol: "TATASTEEL",   name: "Tata Steel Ltd",                  exchange: "NSE", sector: "Metals" },
  { symbol: "POWERGRID",   name: "Power Grid Corporation of India", exchange: "NSE", sector: "Power" },
  { symbol: "NTPC",        name: "NTPC Ltd",                        exchange: "NSE", sector: "Power" },
  { symbol: "M&M",         name: "Mahindra & Mahindra Ltd",         exchange: "NSE", sector: "Auto" },
  { symbol: "ADANIENT",    name: "Adani Enterprises Ltd",           exchange: "NSE", sector: "Conglomerate" },
  { symbol: "ADANIPORTS",  name: "Adani Ports and SEZ Ltd",         exchange: "NSE", sector: "Infrastructure" },
  { symbol: "TECHM",       name: "Tech Mahindra Ltd",               exchange: "NSE", sector: "IT" },
  { symbol: "ONGC",        name: "Oil and Natural Gas Corporation", exchange: "NSE", sector: "Energy" },
  { symbol: "JSWSTEEL",    name: "JSW Steel Ltd",                   exchange: "NSE", sector: "Metals" },
  { symbol: "COALINDIA",   name: "Coal India Ltd",                  exchange: "NSE", sector: "Mining" },
  { symbol: "DIVISLAB",    name: "Divi's Laboratories Ltd",         exchange: "NSE", sector: "Pharma" },
  { symbol: "DRREDDY",     name: "Dr. Reddy's Laboratories Ltd",   exchange: "NSE", sector: "Pharma" },
  { symbol: "CIPLA",       name: "Cipla Ltd",                       exchange: "NSE", sector: "Pharma" },
  { symbol: "EICHERMOT",   name: "Eicher Motors Ltd",               exchange: "NSE", sector: "Auto" },
  { symbol: "HEROMOTOCO",  name: "Hero MotoCorp Ltd",               exchange: "NSE", sector: "Auto" },
  { symbol: "BPCL",        name: "Bharat Petroleum Corporation",    exchange: "NSE", sector: "Energy" },
  { symbol: "TATACONSUM",  name: "Tata Consumer Products Ltd",      exchange: "NSE", sector: "FMCG" },
  { symbol: "APOLLOHOSP",  name: "Apollo Hospitals Enterprise Ltd", exchange: "NSE", sector: "Healthcare" },
  { symbol: "GRASIM",      name: "Grasim Industries Ltd",           exchange: "NSE", sector: "Cement" },
  { symbol: "SBILIFE",     name: "SBI Life Insurance Company Ltd",  exchange: "NSE", sector: "Insurance" },
  { symbol: "HDFCLIFE",    name: "HDFC Life Insurance Company Ltd", exchange: "NSE", sector: "Insurance" },
  { symbol: "INDUSINDBK",  name: "IndusInd Bank Ltd",               exchange: "NSE", sector: "Banking" },
  { symbol: "BRITANNIA",   name: "Britannia Industries Ltd",        exchange: "NSE", sector: "FMCG" },
  { symbol: "PIDILITIND",  name: "Pidilite Industries Ltd",         exchange: "NSE", sector: "Chemicals" },
  { symbol: "DABUR",       name: "Dabur India Ltd",                 exchange: "NSE", sector: "FMCG" },
  { symbol: "HAVELLS",     name: "Havells India Ltd",               exchange: "NSE", sector: "Consumer Durables" },
  { symbol: "TRENT",       name: "Trent Ltd",                       exchange: "NSE", sector: "Retail" },
  { symbol: "ZOMATO",      name: "Zomato Ltd",                      exchange: "NSE", sector: "Internet" },
  { symbol: "PAYTM",       name: "One97 Communications Ltd",        exchange: "NSE", sector: "Fintech" },
  { symbol: "IRCTC",       name: "Indian Railway Catering & Tourism", exchange: "NSE", sector: "Travel" },
  { symbol: "DMART",       name: "Avenue Supermarts Ltd",           exchange: "NSE", sector: "Retail" },
  { symbol: "HAL",         name: "Hindustan Aeronautics Ltd",       exchange: "NSE", sector: "Defence" },
  { symbol: "BEL",         name: "Bharat Electronics Ltd",          exchange: "NSE", sector: "Defence" },
  { symbol: "JIOFIN",      name: "Jio Financial Services Ltd",      exchange: "NSE", sector: "Finance" },
  { symbol: "TATAPOWER",   name: "Tata Power Company Ltd",          exchange: "NSE", sector: "Power" },
  { symbol: "VEDL",        name: "Vedanta Ltd",                     exchange: "NSE", sector: "Metals" },
  { symbol: "SIEMENS",     name: "Siemens Ltd",                     exchange: "NSE", sector: "Capital Goods" },
];

// ── Mutual Fund Data (Popular Direct Growth Funds) ───────────────────────────

const MUTUAL_FUNDS = [
  { scheme_code: "122639", name: "Axis Bluechip Fund - Direct Plan - Growth",                  category: "Large Cap",    amc: "Axis",      plan: "Direct", type: "Growth" },
  { scheme_code: "120505", name: "HDFC Mid-Cap Opportunities Fund - Direct Plan - Growth",     category: "Mid Cap",      amc: "HDFC",      plan: "Direct", type: "Growth" },
  { scheme_code: "119598", name: "SBI Blue Chip Fund - Direct Plan - Growth",                  category: "Large Cap",    amc: "SBI",       plan: "Direct", type: "Growth" },
  { scheme_code: "122655", name: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth",         category: "Flexi Cap",    amc: "PPFAS",     plan: "Direct", type: "Growth" },
  { scheme_code: "120503", name: "HDFC Flexi Cap Fund - Direct Plan - Growth",                 category: "Flexi Cap",    amc: "HDFC",      plan: "Direct", type: "Growth" },
  { scheme_code: "118989", name: "Mirae Asset Large Cap Fund - Direct Plan - Growth",          category: "Large Cap",    amc: "Mirae",     plan: "Direct", type: "Growth" },
  { scheme_code: "125497", name: "Kotak Emerging Equity Fund - Direct Plan - Growth",          category: "Mid Cap",      amc: "Kotak",     plan: "Direct", type: "Growth" },
  { scheme_code: "120716", name: "Nippon India Small Cap Fund - Direct Plan - Growth",         category: "Small Cap",    amc: "Nippon",    plan: "Direct", type: "Growth" },
  { scheme_code: "119775", name: "Aditya Birla Sun Life Frontline Equity Fund - Direct Growth",category: "Large Cap",    amc: "ABSL",      plan: "Direct", type: "Growth" },
  { scheme_code: "118834", name: "ICICI Prudential Bluechip Fund - Direct Plan - Growth",      category: "Large Cap",    amc: "ICICI Pru", plan: "Direct", type: "Growth" },
  { scheme_code: "135781", name: "SBI Small Cap Fund - Direct Plan - Growth",                  category: "Small Cap",    amc: "SBI",       plan: "Direct", type: "Growth" },
  { scheme_code: "119364", name: "DSP Midcap Fund - Direct Plan - Growth",                     category: "Mid Cap",      amc: "DSP",       plan: "Direct", type: "Growth" },
  { scheme_code: "120586", name: "UTI Flexi Cap Fund - Direct Growth Plan",                    category: "Flexi Cap",    amc: "UTI",       plan: "Direct", type: "Growth" },
  { scheme_code: "119062", name: "Kotak Flexicap Fund - Direct Plan - Growth",                 category: "Flexi Cap",    amc: "Kotak",     plan: "Direct", type: "Growth" },
  { scheme_code: "100356", name: "Axis Long Term Equity Fund - Direct Plan - Growth",          category: "ELSS",         amc: "Axis",      plan: "Direct", type: "Growth" },
  { scheme_code: "120837", name: "HDFC Balanced Advantage Fund - Direct Plan - Growth",        category: "Balanced",     amc: "HDFC",      plan: "Direct", type: "Growth" },
  { scheme_code: "120465", name: "SBI Equity Hybrid Fund - Direct Plan - Growth",              category: "Hybrid",       amc: "SBI",       plan: "Direct", type: "Growth" },
  { scheme_code: "145552", name: "Quant Small Cap Fund - Direct Plan - Growth",                category: "Small Cap",    amc: "Quant",     plan: "Direct", type: "Growth" },
  { scheme_code: "119778", name: "Canara Robeco Bluechip Equity Fund - Direct Plan - Growth",  category: "Large Cap",    amc: "Canara",    plan: "Direct", type: "Growth" },
  { scheme_code: "118632", name: "Tata Digital India Fund - Direct Plan - Growth",             category: "Sectoral",     amc: "Tata",      plan: "Direct", type: "Growth" },
  { scheme_code: "119237", name: "ICICI Prudential Technology Fund - Direct Plan - Growth",    category: "Sectoral",     amc: "ICICI Pru", plan: "Direct", type: "Growth" },
  { scheme_code: "120847", name: "Motilal Oswal Nasdaq 100 FOF - Direct Plan - Growth",        category: "International",amc: "Motilal",   plan: "Direct", type: "Growth" },
  { scheme_code: "147622", name: "Motilal Oswal S&P 500 Index Fund - Direct Growth",           category: "International",amc: "Motilal",   plan: "Direct", type: "Growth" },
  { scheme_code: "120828", name: "HDFC Index Fund - NIFTY 50 Plan - Direct Growth",            category: "Index",        amc: "HDFC",      plan: "Direct", type: "Growth" },
  { scheme_code: "120684", name: "UTI Nifty 50 Index Fund - Direct Growth Plan",               category: "Index",        amc: "UTI",       plan: "Direct", type: "Growth" },
  { scheme_code: "119688", name: "Axis Midcap Fund - Direct Plan - Growth",                    category: "Mid Cap",      amc: "Axis",      plan: "Direct", type: "Growth" },
  { scheme_code: "135856", name: "Axis Small Cap Fund - Direct Plan - Growth",                 category: "Small Cap",    amc: "Axis",      plan: "Direct", type: "Growth" },
  { scheme_code: "119533", name: "Mirae Asset Tax Saver Fund - Direct Plan - Growth",          category: "ELSS",         amc: "Mirae",     plan: "Direct", type: "Growth" },
  { scheme_code: "120594", name: "ICICI Prudential Value Discovery Fund - Direct Growth",      category: "Value",        amc: "ICICI Pru", plan: "Direct", type: "Growth" },
  { scheme_code: "143537", name: "Edelweiss Balanced Advantage Fund - Direct Plan - Growth",   category: "Balanced",     amc: "Edelweiss", plan: "Direct", type: "Growth" },
];

// ── Seed Functions ───────────────────────────────────────────────────────────

async function seedStocks() {
  const batch = db.batch();
  let count = 0;

  for (const stock of STOCKS) {
    const docRef = db.collection("stocks").doc(stock.symbol);
    batch.set(docRef, {
      ...stock,
      search_name: stock.name.toLowerCase(),
    });
    count++;
  }

  await batch.commit();
  console.log(`✓ Seeded ${count} stocks`);
}

async function seedMutualFunds() {
  const batch = db.batch();
  let count = 0;

  for (const mf of MUTUAL_FUNDS) {
    const docRef = db.collection("mutual_funds").doc(mf.scheme_code);
    batch.set(docRef, {
      ...mf,
      search_name: mf.name.toLowerCase(),
    });
    count++;
  }

  await batch.commit();
  console.log(`✓ Seeded ${count} mutual funds`);
}

// ── Run ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding Firestore collections...\n");

  try {
    await seedStocks();
    await seedMutualFunds();
    console.log("\n✓ All data seeded successfully!");
    console.log("\nFirestore collections created:");
    console.log("  • stocks        — " + STOCKS.length + " documents");
    console.log("  • mutual_funds  — " + MUTUAL_FUNDS.length + " documents");
    console.log("\nRequired indexes (create in Firebase Console → Firestore → Indexes):");
    console.log("  • stocks:        composite index on (symbol ASC) — auto-created");
    console.log("  • stocks:        composite index on (search_name ASC) — auto-created");
    console.log("  • mutual_funds:  composite index on (search_name ASC) — auto-created");
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }

  process.exit(0);
}

main();
