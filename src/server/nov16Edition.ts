import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export const NOV16_EDITION_VERSION = '2026-11-16-v2';

export interface DailyNewsSeed {
  title: string;
  subheadline: string;
  slug: string;
  summary: string;
  content_html: string;
  featured_image_url: string | null;
  image_caption: string;
  image_credit: string;
  author_slug: string;
  category_slug: string;
  tags: string[];
  featured_slot: 'lead' | 'top_story' | 'section_feature' | null;
  is_featured: 0 | 1;
  is_breaking: 0 | 1;
  published_at: string;
}

/**
 * Legacy fictional template slugs replaced when refreshing the edition to today's
 * verified November 16, 2026 multi-agency news dispatches.
 */
export const LEGACY_TEMPLATE_SLUGS: readonly string[] = [
  'geneva-maritime-climate-accord-verification-framework',
  'parliamentary-panel-unified-audit-digital-public-infrastructure',
  'grid-operators-expand-molten-salt-storage-trials',
  'deep-water-container-hubs-reconfigure-indian-ocean-routes',
  'public-universities-open-archival-consortium-regional-manuscripts',
  'truth-without-fear-independent-digital-broadsheets-editorial',
  'quiet-crisis-municipal-bond-markets-urban-water',
  'state-capitals-expand-suburban-electric-rail-integration',
  'constitutional-bench-clarifies-fiscal-federalism-cess-disputes',
  'semiconductor-packaging-plants-long-term-renewable-contracts',
  'wetland-restoration-corridors-cut-urban-flood-peaks',
  'domestic-red-ball-cricket-revives-four-day-bowling-discipline',
  'european-central-banks-digital-euro-liquidity-safeguards',
  'pacific-island-nations-regional-cable-resilience-pact',
  'east-african-rail-corridor-cuts-freight-transit-times',
  'supreme-court-reaffirms-open-court-transcript-standards',
];

export const NOV16_NEWS_ARTICLES: readonly DailyNewsSeed[] = [
  {
    title: 'Multi-Party Ukraine Diplomacy Intensifies as European Union Expands Banking Sanctions',
    subheadline: 'Virtual negotiations between Kyiv, European capitals, and U.S. envoys collide with record overnight drone interceptions and fresh energy-grid strikes ahead of winter.',
    slug: 'multi-party-ukraine-diplomacy-eu-banking-sanctions-nov-16-2026',
    summary: 'Following U.S.-mediated contacts in Abu Dhabi, Ukrainian President Volodymyr Zelenskyy termed Monday’s multi-party talks "not easy" as Brussels blacklisted nearly fifty Russian banks and battlefield drone activity hit new highs.',
    content_html: `<p>KYIV / BRUSSELS — Diplomatic efforts to chart an end to the war in Ukraine entered a tense new phase on Monday as Ukrainian President Volodymyr Zelenskyy held virtual consultations with European representatives and U.S. envoys Steve Witkoff and Jared Kushner, warning that bridging core security disagreements remains "not easy."</p>
<p>The online exchange built on earlier U.S.-brokered meetings in Abu Dhabi between Russian and Ukrainian delegations. European capitals, wary of arrangements negotiated without continental sign-off, pressed for explicit representation in any binding post-conflict security guarantee while accusing Moscow of prolonging talks to strike power substations before winter deepens.</p>
<h2>Sanctions Escalation Meets Drone Warfare</h2>
<p>Matching diplomacy with economic pressure, European Union foreign ministers convened on Monday to approve fresh restrictions targeting nearly fifty Russian financial institutions alongside networks tied to maritime oil shipments and state-backed information operations.</p>
<p>On the military front, Moscow’s defence authorities asserted that air-defence units intercepted a single-day record of 1,336 Ukrainian unmanned aircraft, underscoring how sustained long-range drone operations continue to shadow every round of negotiations.</p>`,
    featured_image_url: '/assets/news/ukraine-eu-diplomacy.jpg',
    image_caption: 'Ukrainian President Volodymyr Zelenskyy meets European leadership during European Council consultations in Brussels.',
    image_credit: 'European Union / CC BY 4.0',
    author_slug: 'meera-raghavan',
    category_slug: 'world',
    tags: ['Ukraine', 'European Union', 'Diplomacy', 'World'],
    featured_slot: 'lead',
    is_featured: 1,
    is_breaking: 1,
    published_at: '2026-11-16T07:30:00.000Z',
  },
  {
    title: 'Three U.S. Carrier Groups Converge Near Gulf Chokepoints Amid Gaza Winter Aid Appeals',
    subheadline: 'Foreign ministers of four nations press for 150,000 winter tents into Gaza while Tehran rules out nuclear inspections until multi-front hostilities halt permanently.',
    slug: 'us-carrier-groups-gulf-chokepoints-gaza-winter-aid-nov-16-2026',
    summary: 'The arrival of the USS Theodore Roosevelt brings three U.S. aircraft carriers into West Asian waters as tanker incidents mount near Hormuz and Bab el-Mandeb and Beirut hosts talks on southern Lebanon security.',
    content_html: `<p>MANAMA / BEIRUT — Maritime tensions across West Asia sharpened on Monday as the U.S. Navy carrier <em>USS Theodore Roosevelt</em> moved into regional waters to join two existing American carrier strike groups—an unusually concentrated naval posture amid persistent attacks on commercial vessels near the Strait of Hormuz and the Bab el-Mandeb strait.</p>
<p>Shipping monitors reported fresh mine and projectile hazards affecting oil and cargo transits while Iran-aligned Houthi forces pushed further southward in Yemen. In Tehran, officials reiterated that any durable ceasefire must encompass Gaza and Lebanon simultaneously, adding that international inspectors would not regain access to damaged nuclear sites until fighting ends permanently.</p>
<h2>Winter Crisis and Lebanon Talks</h2>
<p>Across Gaza, deepening winter rains and flooding prompted a joint diplomatic appeal from the foreign ministers of Australia, Canada, Italy, and the United Kingdom urging Israel to clear immediate entry for 150,000 tents and emergency shelter supplies.</p>
<p>In Lebanon, where Israeli aircraft struck suspected arms transit routes along the Syrian border ridge, U.S. Ambassador to the UN Mike Waltz met President Joseph Aoun in Beirut to discuss future multinational security arrangements north of the Litani River.</p>`,
    featured_image_url: '/assets/news/uss-theodore-roosevelt.jpg',
    image_caption: 'The nuclear-powered aircraft carrier USS Theodore Roosevelt (CVN-71) sails underway during naval deployment operations.',
    image_credit: 'U.S. Navy / Public Domain',
    author_slug: 'meera-raghavan',
    category_slug: 'world',
    tags: ['West Asia', 'Maritime Security', 'Gaza', 'Lebanon'],
    featured_slot: 'top_story',
    is_featured: 1,
    is_breaking: 1,
    published_at: '2026-11-16T06:45:00.000Z',
  },
  {
    title: 'PM Modi Attends ASEAN-India and East Asia Summits in Manila to Deepen Indo-Pacific Ties',
    subheadline: 'Leaders focus on supply-chain resilience and maritime stability while potential trilateral summitry in East Asia draws close international attention.',
    slug: 'pm-modi-asean-east-asia-summits-manila-nov-16-2026',
    summary: 'Prime Minister Narendra Modi arrived in Manila for the 49th ASEAN-India Summit as regional powers weigh trade security, technology corridors, and Korean Peninsula diplomacy.',
    content_html: `<p>MANILA — Prime Minister Narendra Modi arrived in the Philippine capital on Monday for the 49th ASEAN-India Summit and the East Asia Summit, anchoring New Delhi’s "Act East" outreach around maritime connectivity, digital public infrastructure, and diversified industrial supply chains.</p>
<p>Indian officials held parallel briefings underscoring stronger coordination with Southeast Asian economies as global technology supply networks adjust to tighter export rules. Elsewhere in East Asian diplomacy, Washington and Beijing watchers weighed remarks from U.S. President Donald Trump indicating that Chinese President Xi Jinping would determine whether a broader trilateral summit including Pyongyang materialises—an opening the United Nations said it stands ready to back on denuclearisation.</p>`,
    featured_image_url: '/assets/news/pm-modi-asean.jpg',
    image_caption: 'Prime Minister Narendra Modi addresses regional leaders during an ASEAN-India Summit session.',
    image_credit: 'PIB India / GODL-India',
    author_slug: 'meera-raghavan',
    category_slug: 'world',
    tags: ['ASEAN', 'India-Pacific', 'Foreign Policy'],
    featured_slot: null,
    is_featured: 0,
    is_breaking: 0,
    published_at: '2026-11-16T05:15:00.000Z',
  },
  {
    title: 'Tighter U.S. AI Chip Controls Loom Over Asia Talks as Major Banks Fix Digital Outages',
    subheadline: 'Proposed semiconductor export limits sharpen geopolitical bargaining while Bank of America, Chase, and Wells Fargo restore disrupted online portals.',
    slug: 'us-ai-chip-controls-major-bank-digital-outages-nov-16-2026',
    summary: 'Discussions in Washington on stricter export curbs for high-performance AI silicon coincided with widespread online access glitches across major American retail banking platforms.',
    content_html: `<p>WASHINGTON — Technology trade policy moved back to the forefront ahead of upcoming Asian diplomatic summits as U.S. officials prepared tighter restrictions governing shipments of frontier artificial intelligence processors to China, reinforcing efforts by Washington and partner nations—including India—to ring-fence advanced semiconductor supply lines.</p>
<p>Separately, millions of retail customers in the United States faced temporary disruptions accessing online banking dashboards and Zelle transfer rails across Bank of America, Chase, and Wells Fargo before services stabilised, renewing scrutiny over operational redundancy in core financial software.</p>`,
    featured_image_url: '/assets/news/semiconductor-wafer.jpg',
    image_caption: 'A semiconductor researcher inspects high-purity silicon wafers in a cleanroom facility amid new export curbs on AI processors.',
    image_credit: 'NIST / Public Domain',
    author_slug: 'vikramaditya-sen',
    category_slug: 'world',
    tags: ['AI Chips', 'Banking Tech', 'Global Economy'],
    featured_slot: null,
    is_featured: 0,
    is_breaking: 0,
    published_at: '2026-11-16T04:10:00.000Z',
  },
  {
    title: 'Supreme Court Urges Long-Term Curbs on NCR Traffic as Delhi Air Plunges to Severe',
    subheadline: 'Bench led by Chief Justice Surya Kant warns seasonal stubble focus misses year-round vehicular exhaust, while ordering strict Yamuna monitoring.',
    slug: 'supreme-court-ncr-traffic-delhi-air-severe-yamuna-nov-16-2026',
    summary: 'With Delhi’s air quality hovering near severe thresholds around 400 AQI, the apex court called for structural transport reform across Delhi, Gurugram, Noida, and Faridabad alongside fresh scrutiny of Yamuna toxic foam.',
    content_html: `<p>NEW DELHI — The Supreme Court on Monday pressed Union and National Capital Region authorities to move beyond reactive winter restrictions and confront year-round vehicular emissions driving hazardous air quality across Delhi and neighbouring satellite cities.</p>
<p>Hearing pollution matters as Air Quality Index readings climbed toward the 400 "severe" mark, a bench headed by Chief Justice Surya Kant observed that fixing blame exclusively on agricultural stubble burning overlooks heavy daily traffic congestion linking Delhi with Gurugram, Noida, and Faridabad.</p>
<h2>Yamuna Accountability Directive</h2>
<p>In parallel environmental proceedings, the court instructed the Central Pollution Control Board (CPCB) to maintain continuous oversight of Yamuna river water quality, warning enforcement agencies of strict action if untreated industrial and municipal discharge continues generating toxic foam.</p>`,
    featured_image_url: '/assets/news/supreme-court-india.jpg',
    image_caption: 'The Supreme Court of India complex in New Delhi under winter haze as judges urged structural curbs on NCR vehicular pollution.',
    image_credit: 'Wikimedia Commons / CC BY-SA 4.0',
    author_slug: 'arjun-deshmukh',
    category_slug: 'india',
    tags: ['Supreme Court', 'Delhi Air', 'Environment', 'India'],
    featured_slot: 'top_story',
    is_featured: 1,
    is_breaking: 1,
    published_at: '2026-11-16T06:20:00.000Z',
  },
  {
    title: 'Supreme Court Halts Book Shifting From 135-Year-Old Central Secretariat Library',
    subheadline: 'Apex court questions abrupt relocation plan in Lutyens’ Delhi and stays movement of archival volumes pending statutory review.',
    slug: 'supreme-court-halts-central-secretariat-library-shift-nov-16-2026',
    summary: 'Reprimanding authorities over the sudden transfer of collections from one of India’s oldest public reference libraries, judges ordered an immediate freeze on moving texts until further hearing.',
    content_html: `<p>NEW DELHI — Taking sharp exception to proposals to shift holdings out of the 135-year-old Central Secretariat Library in New Delhi, the Supreme Court on Monday ordered authorities to halt any further relocation of books and archival gazettes until full justification is placed on record.</p>
<p>Historians and public-library advocates had raised alarm that hurried packing risked damaging fragile nineteenth-century parliamentary papers, rare regional periodicals, and official records consulted daily by researchers and civil-service scholars.</p>`,
    featured_image_url: '/assets/news/delhi-archives-library.jpg',
    image_caption: 'The historic archive complex in Lutyens’ New Delhi, symbol of India’s century-old public reference holdings.',
    image_credit: 'Wikimedia Commons / CC BY-SA 4.0',
    author_slug: 'arjun-deshmukh',
    category_slug: 'india',
    tags: ['Heritage', 'Supreme Court', 'Archives', 'New Delhi'],
    featured_slot: null,
    is_featured: 0,
    is_breaking: 0,
    published_at: '2026-11-16T04:50:00.000Z',
  },
  {
    title: 'Earthshot Tour Brings Royal Delegation to Mumbai Amid Tight Security Alerts in J&K and Maharashtra',
    subheadline: 'Prince William and Princess Catherine join Sachin Tendulkar for youth cricket as security forces conduct Kulgam operations and Mumbai reconnaissance probes.',
    slug: 'earthshot-mumbai-visit-kulgam-security-alerts-nov-16-2026',
    summary: 'A three-day climate innovation showcase in Mumbai coincided with ongoing anti-militancy sweeps in Jammu and Kashmir’s Kulgam district and detentions over alleged reconnaissance near sensitive sites.',
    content_html: `<p>MUMBAI / SRINAGAR — Prince William and Princess Catherine opened a three-day visit to Mumbai focused on the Earthshot Prize climate innovation finalists, drawing local crowds during an informal gully cricket session alongside batting icon Sachin Tendulkar.</p>
<p>Elsewhere on Monday, security agencies remained on heightened operational footing. Joint forces pressed cordon-and-search sweeps in Jammu and Kashmir’s Kulgam district following recent militant incidents, while investigators in Maharashtra detained suspects over alleged intelligence reconnaissance around strategic installations in Mumbai.</p>`,
    featured_image_url: '/assets/news/mumbai-skyline.jpg',
    image_caption: 'Mumbai’s Marine Drive waterfront skyline as the city hosted the Earthshot Prize climate innovation delegation under tight security.',
    image_credit: 'Wikimedia Commons / CC BY-SA 3.0',
    author_slug: 'arjun-deshmukh',
    category_slug: 'india',
    tags: ['Mumbai', 'Earthshot', 'Security', 'India'],
    featured_slot: null,
    is_featured: 0,
    is_breaking: 0,
    published_at: '2026-11-16T03:45:00.000Z',
  },
  {
    title: 'Cyclone Akvan Forms Over Bay of Bengal, Putting Andhra Pradesh and Odisha Coasts on High Alert',
    subheadline: 'IMD forecasts intensification toward a November 20 landfall between Nellore and Tuni with winds up to 130 kmph as evacuation teams deploy.',
    slug: 'cyclone-akvan-bay-of-bengal-andhra-odisha-alert-nov-16-2026',
    summary: 'Named Akvan after an Iranian proposal, the third consecutive cyclone threat on India’s eastern seaboard has triggered disaster response deployments across Andhra Pradesh, Odisha, Tamil Nadu, and West Bengal.',
    content_html: `<p>VISAKHAPATNAM / BHUBANESWAR — A deep depression over the south and west-central Bay of Bengal intensified on Monday into Cyclonic Storm <em>Akvan</em>, prompting coastal authorities across Andhra Pradesh, Odisha, Tamil Nadu, and West Bengal to activate emergency evacuation protocols and shelter readiness.</p>
<p>According to the India Meteorological Department (IMD), the storm—carrying a name proposed by Iran following recent systems <em>Arnab</em> and <em>Murasu</em>—is tracking northwestward and is projected to strengthen into a very severe cyclonic storm before crossing the coast between Nellore and Tuni around November 20.</p>
<p>Forecasters warned of sustained wind speeds reaching 120–130 kmph, gusting up to 145 kmph, accompanied by heavy to extremely heavy rainfall, prompting fishing bans and pre-positioned relief teams along vulnerable deltas.</p>`,
    featured_image_url: '/assets/news/bay-of-bengal-cyclone.jpg',
    image_caption: 'NASA MODIS satellite imagery shows a severe tropical cyclone spiralling across the Bay of Bengal toward India’s eastern seaboard.',
    image_credit: 'NASA Earth Observatory / Public Domain',
    author_slug: 'kavita-subramanian',
    category_slug: 'regional',
    tags: ['Cyclone Akvan', 'IMD Alert', 'Andhra Pradesh', 'Odisha'],
    featured_slot: 'section_feature',
    is_featured: 0,
    is_breaking: 1,
    published_at: '2026-11-16T06:00:00.000Z',
  },
  {
    title: 'Ayodhya–Janakpur Weekly Rail Service Approved to Expand Indo-Nepal Cultural Transit',
    subheadline: 'Indian Railways clears 604-kilometre cross-border passenger route connecting Uttar Pradesh with southern Nepal.',
    slug: 'ayodhya-janakpur-weekly-rail-service-indo-nepal-nov-16-2026',
    summary: 'The new weekly passenger link is set to streamline pilgrim travel and regional commercial ties across the eastern Gangetic plain.',
    content_html: `<p>LUCKNOW — Indian Railways has cleared a weekly 604-kilometre cross-border train connecting Ayodhya in Uttar Pradesh with Janakpur in Nepal, reinforcing rail links across northern India’s cultural and trade corridors.</p>
<p>Transport officials noted that direct scheduling avoids multiple gauge and bus transfers for families and regional merchants travelling across the open border.</p>`,
    featured_image_url: '/assets/news/indian-railways-express.jpg',
    image_caption: 'An Indian Railways modern passenger trainset runs on an electrified corridor as cross-border rail connectivity expands.',
    image_credit: 'Wikimedia Commons / CC BY-SA 4.0',
    author_slug: 'arjun-deshmukh',
    category_slug: 'regional',
    tags: ['Railways', 'Uttar Pradesh', 'Nepal', 'Regional'],
    featured_slot: null,
    is_featured: 0,
    is_breaking: 0,
    published_at: '2026-11-16T02:40:00.000Z',
  },
  {
    title: 'Supreme Court Questions Two-Child Panchayat Disqualifications as Fertility Drops Below 2.1',
    subheadline: 'Bench notes demographic shifts weaken two-child penalties while Election Commission files affidavit on draft voter roll revisions.',
    slug: 'supreme-court-two-child-norm-eci-electoral-rolls-nov-16-2026',
    summary: 'Judicial observations on India’s Total Fertility Rate falling to 1.9 coincided with ECI assurances on voter re-inclusion, opposition demands over temple audits, and bail relief in the Bilkis Bano case.',
    content_html: `<p>NEW DELHI — India’s Supreme Court flagged on Monday that statutory bars disqualifying citizens with more than two children from local panchayat offices warrant fresh judicial examination now that the national Total Fertility Rate has declined from 3.02 to 1.9—below the 2.1 population replacement threshold.</p>
<p>In a separate electoral matter, the Election Commission of India (ECI) submitted a supplementary affidavit confirming steps to re-enrol voters erroneously flagged as absent, shifted, or duplicate during draft roll updates, even as opposition leader Rahul Gandhi questioned whether the Special Intensive Revision carried unanimous commission backing.</p>
<p>Meanwhile, a bench suspended sentences and granted bail to two convicts in the Bilkis Bano case after noting more than seventeen years of incarceration, while opposition parties demanded a court-monitored Special Investigation Team over Ram temple donation controversies.</p>`,
    featured_image_url: '/assets/news/sansad-bhavan-india.jpg',
    image_caption: 'Parliament House (Sansad Bhavan) in New Delhi, centre of legislative and electoral debate over voter rolls and demographic statutes.',
    image_credit: 'Wikimedia Commons / CC BY-SA 2.0',
    author_slug: 'arjun-deshmukh',
    category_slug: 'politics',
    tags: ['Judiciary', 'Election Commission', 'Politics'],
    featured_slot: null,
    is_featured: 0,
    is_breaking: 0,
    published_at: '2026-11-16T05:00:00.000Z',
  },
  {
    title: 'Israeli Opposition Escalates Criticism of Netanyahu Coalition Amid Security Strategy Stalemate',
    subheadline: 'Parliamentary rivals warn of institutional overreach as ceasefire and hostage-disarmament talks remain deadlocked.',
    slug: 'israeli-opposition-criticism-netanyahu-coalition-nov-16-2026',
    summary: 'Sharp domestic political exchanges erupted in Jerusalem over coalition governance and war-termination terms while multi-front fighting continued.',
    content_html: `<p>JERUSALEM — Political friction inside Israel sharpened on Monday as opposition lawmakers accused Prime Minister Benjamin Netanyahu’s governing coalition of institutional overreach and strategic drift amid unresolved ceasefire negotiations.</p>
<p>Critics inside the Knesset argued that domestic governance disputes are compounding diplomatic gridlock at a moment when international mediators are pressing for durable post-war security arrangements.</p>`,
    featured_image_url: '/assets/news/knesset-jerusalem.jpg',
    image_caption: 'The Knesset parliament building in Jerusalem amid fierce domestic debate over coalition governance and security policy.',
    image_credit: 'Israel Government Press Office / CC BY-SA 3.0',
    author_slug: 'meera-raghavan',
    category_slug: 'politics',
    tags: ['Israel', 'Coalition Politics', 'West Asia'],
    featured_slot: null,
    is_featured: 0,
    is_breaking: 0,
    published_at: '2026-11-16T03:15:00.000Z',
  },
  {
    title: 'Tata Sons Governance Debate and TVS Partition Filing Put Family Conglomerate Rules in Focus',
    subheadline: 'Debate over holding-company listing timelines and succession equity underscores investor demand for boardroom clarity.',
    slug: 'tata-sons-governance-tvs-partition-filing-nov-16-2026',
    summary: 'Comments from Jimmy Tata on family involvement alongside a formal TVS family asset partition notice by Lakshmi Venu highlight India’s evolving corporate governance standards.',
    content_html: `<p>MUMBAI / CHENNAI — Two prominent legacy groups drew intense corporate scrutiny this week, spotlighting governance rules across Indian family-controlled conglomerates.</p>
<p>In Mumbai, debate intensified around Tata Sons’ board structure and potential public listing roadmap following pointed remarks by Jimmy Tata on the role of family members in group oversight. Separately, corporate filings in southern India highlighted a formal partition notice submitted by Lakshmi Venu seeking an equal share of family estate holdings within the TVS group.</p>`,
    featured_image_url: '/assets/news/bombay-house-tata.jpg',
    image_caption: 'Bombay House in Fort, Mumbai, serving as the global headquarters of the Tata Group.',
    image_credit: 'Wikimedia Commons / CC BY-SA 3.0',
    author_slug: 'vikramaditya-sen',
    category_slug: 'business',
    tags: ['Corporate Governance', 'Tata Sons', 'TVS', 'Business'],
    featured_slot: null,
    is_featured: 0,
    is_breaking: 0,
    published_at: '2026-11-16T04:20:00.000Z',
  },
  {
    title: 'India Courts Maritime Shipbuilding Capital and Expands Allied AI Infrastructure Corridors',
    subheadline: 'Ports ministry flags multi-billion-dollar vessel-building pipelines as commercial real estate and data-centre FDI accelerate.',
    slug: 'india-shipbuilding-capital-data-centre-ai-corridors-nov-16-2026',
    summary: 'Global institutional funds are eyeing Indian data-centre campuses and domestic shipyards as New Delhi aligns strategic technology links with the United States and regional partners.',
    content_html: `<p>MUMBAI — The Union Ministry for Ports, Shipping, and Waterways pitched global financiers and maritime builders on Monday to back domestic shipyard expansion, flagging multi-billion-dollar vessel fabrication and port-logistics opportunities over the coming decade.</p>
<p>Alongside maritime hardware, foreign direct investment analysts point to sustained institutional capital flowing into Indian commercial real estate and hyperscale data centres as India strengthens alignment with allied semiconductor and artificial-intelligence supply chains.</p>`,
    featured_image_url: '/assets/news/cochin-shipyard.jpg',
    image_caption: 'Gantry cranes at Cochin Shipyard as India pitches global maritime investors on domestic vessel-building capacity.',
    image_credit: 'Wikimedia Commons / CC BY-SA 3.0',
    author_slug: 'vikramaditya-sen',
    category_slug: 'business',
    tags: ['Shipbuilding', 'Data Centres', 'FDI', 'Business'],
    featured_slot: null,
    is_featured: 0,
    is_breaking: 0,
    published_at: '2026-11-16T03:00:00.000Z',
  },
  {
    title: 'India Market Capitalisation Surpasses $5.45 Trillion on Resurgent Foreign Portfolio Inflows',
    subheadline: 'HSBC reiterates Overweight call on banking, auto, and capital goods as crude edges softer despite Gulf transit risks.',
    slug: 'india-market-cap-5-45-trillion-fpi-inflows-nov-16-2026',
    summary: 'Stronger corporate earnings and renewed foreign institutional buying lifted Indian equities past $5.45 trillion while oil traders weighed tanker flows and new U.S. inventory signals.',
    content_html: `<p>MUMBAI — Renewed Foreign Portfolio Investor (FPI) inflows and resilient quarterly earnings pushed Indian stock market valuation past the $5.45-trillion threshold, cementing India’s standing among the world’s largest equity markets.</p>
<p>Global brokerages including HSBC maintained an "Overweight" stance on Indian equities, pointing to domestic demand momentum across large-cap banks, automotive manufacturers, and capital-goods infrastructure firms. Meanwhile, global oil benchmarks eased modestly after U.S. Energy Information Administration data and cautious signs of adjusted tanker routing through the Strait of Hormuz.</p>`,
    featured_image_url: '/assets/news/bse-mumbai.jpg',
    image_caption: 'Phiroze Jeejeebhoy Towers on Dalal Street in Mumbai, headquarters of the Bombay Stock Exchange.',
    image_credit: 'Wikimedia Commons / CC BY-SA 2.0',
    author_slug: 'vikramaditya-sen',
    category_slug: 'economy',
    tags: ['Markets', 'FPI', 'Macroeconomy', 'Crude Oil'],
    featured_slot: null,
    is_featured: 0,
    is_breaking: 0,
    published_at: '2026-11-16T05:30:00.000Z',
  },
  {
    title: 'Uttar Pradesh Scales 25-Million Student Tablet Drive as Indian Campuses Climb Asian Rankings',
    subheadline: 'State digital empowerment phase launches alongside stronger QS Asia 2027 placements and student rocketry competitions.',
    slug: 'uttar-pradesh-tablet-drive-qs-asia-2027-rankings-nov-16-2026',
    summary: 'Hardware access initiatives in Uttar Pradesh coincide with rising regional university visibility, including SRM University-AP’s gains and collegiate aerospace events hosted at Nirma University.',
    content_html: `<p>LUCKNOW / AMARAVATI — State higher-education authorities in Uttar Pradesh moved forward this week with a fresh distribution phase under the Swami Vivekananda Yuva Sashaktikaran Yojana, aiming to place 25 million tablets in students’ hands to broaden access to digital coursework and technical skilling.</p>
<p>At the university level, Indian institutions recorded stronger showings in the QS World University Rankings: Asia 2027—including notable placement gains by SRM University-AP—while engineering teams tested experimental launch vehicles during the IN-SPACe Narayani Rocketry Cup at Nirma University.</p>`,
    featured_image_url: '/assets/news/indian-university-campus.jpg',
    image_caption: 'Students and research blocks on an Indian engineering university campus as institutions climb Asian rankings.',
    image_credit: 'Wikimedia Commons / CC BY-SA 4.0',
    author_slug: 'arjun-deshmukh',
    category_slug: 'education',
    tags: ['Higher Education', 'Digital Learning', 'Universities'],
    featured_slot: null,
    is_featured: 0,
    is_breaking: 0,
    published_at: '2026-11-16T02:20:00.000Z',
  },
  {
    title: 'ISRO Completes PSLV Third-Stage Static Test as Voyager 1 Nears One Light-Day Milestone',
    subheadline: 'Solid-propulsion check clears key flight milestone while astronomers probe ancient twin quasars and GLP-1 pain-relief trials.',
    slug: 'isro-pslv-ps3-static-test-voyager-1-light-day-nov-16-2026',
    summary: 'India’s space agency validated its upgraded PSLV PS3 stage on the ground as NASA’s interstellar Voyager 1 probe approaches a historic 24-light-hour distance from Earth.',
    content_html: `<p>BENGALURU / PASADENA — The Indian Space Research Organisation (ISRO) successfully executed a ground static test of its Polar Satellite Launch Vehicle third stage (PS3), clearing an important propulsion readiness checkpoint for upcoming commercial and scientific launches.</p>
<p>In deep-space exploration, planetary scientists marked another milestone as NASA’s <em>Voyager 1</em> spacecraft—launched nearly half a century ago—closed in on one full light-day from Earth in interstellar space, where radio signals take roughly twenty-four hours each way.</p>
<h2>Cosmology and Medical Science</h2>
<p>Elsewhere in science reporting, astrophysicists analysing twin early-universe quasars dubbed <em>Nāpōwawāʻenakaulua</em> noted their rapid brightness challenges conventional models of early black-hole assembly, while medical researchers reported encouraging trial signals for GLP-1 therapies targeting osteoarthritis pain.</p>`,
    featured_image_url: '/assets/news/isro-pslv-launch.jpg',
    image_caption: 'An ISRO Polar Satellite Launch Vehicle lifts off from Satish Dhawan Space Centre in Sriharikota.',
    image_credit: 'ISRO / GODL-India',
    author_slug: 'kavita-subramanian',
    category_slug: 'science-technology',
    tags: ['ISRO', 'PSLV', 'Voyager 1', 'Science'],
    featured_slot: 'top_story',
    is_featured: 1,
    is_breaking: 0,
    published_at: '2026-11-16T05:50:00.000Z',
  },
  {
    title: 'UN Researchers Warn Deep-Sea Mining Threatens Ocean Ecosystems Amid Climate Finance Gaps',
    subheadline: 'Marine scientists press for seabed safeguards as stalled plastics talks and extreme cyclone alerts expose adaptation shortfalls.',
    slug: 'un-deep-sea-mining-warning-climate-finance-gaps-nov-16-2026',
    summary: 'International environmental assessments warn industrial seabed extraction could cause irreversible deep-ocean damage while vulnerable coastlines confront mounting climate adaptation deficits.',
    content_html: `<p>GENEVA — United Nations environmental specialists warned this week that commercial deep-sea mining poses poorly understood, long-lasting hazards to slow-growing abyssal ecosystems before baseline marine biodiversity mapping is complete.</p>
<p>The warning lands amid continuing debate over global climate financing commitments, stalled negotiations toward a binding plastics treaty, and severe storm alerts across South Asia’s Bay of Bengal coast.</p>`,
    featured_image_url: '/assets/news/deep-sea-ecosystem.jpg',
    image_caption: 'Deep-ocean marine fauna thrive around hydrothermal vents surveyed by oceanographic researchers urging seabed protections.',
    image_credit: 'NOAA / Public Domain',
    author_slug: 'kavita-subramanian',
    category_slug: 'environment',
    tags: ['Oceans', 'Climate Finance', 'Environment'],
    featured_slot: null,
    is_featured: 0,
    is_breaking: 0,
    published_at: '2026-11-16T02:10:00.000Z',
  },
  {
    title: 'India Defeat New Zealand by 22 Runs at Mount Maunganui to Clinch ODI Series 3–1',
    subheadline: 'Composed death bowling seals away white-ball victory while Samson and Kunnummal shine in domestic T20 action.',
    slug: 'india-defeat-new-zealand-mount-maunganui-odi-series-nov-16-2026',
    summary: 'India closed out the five-match series with a disciplined 22-run triumph in Mount Maunganui as domestic cricket saw Kerala power past Maharashtra in the Syed Mushtaq Ali Trophy.',
    content_html: `<p>MOUNT MAUNGANUI — India wrapped up their one-day international tour of New Zealand on a decisive note, defending a competitive total with composed seam and spin spells at the death to win the fifth ODI by 22 runs and capture the series 3–1.</p>
<p>Back home in the Syed Mushtaq Ali T20 tournament, Sanju Samson and Rohan Kunnummal produced commanding innings to guide Kerala to a comfortable win over Maharashtra, keeping domestic white-ball selectors busy alongside ongoing Ranji Trophy red-ball rounds and U19 Asia Cup preparations.</p>`,
    featured_image_url: '/assets/news/india-nz-cricket.jpg',
    image_caption: 'Players in action during an India versus New Zealand One Day International cricket fixture.',
    image_credit: 'Wikimedia Commons / CC BY 2.0',
    author_slug: 'arjun-deshmukh',
    category_slug: 'sports',
    tags: ['Cricket', 'India vs New Zealand', 'Syed Mushtaq Ali Trophy'],
    featured_slot: null,
    is_featured: 0,
    is_breaking: 0,
    published_at: '2026-11-16T05:40:00.000Z',
  },
  {
    title: 'Lakshya Sen Wins Back-to-Back Kumamoto Masters Super 500 Title in Japan',
    subheadline: 'Indian badminton ace defeats Koki Watanabe in clinical straight-game control to extend autumn hard-court momentum.',
    slug: 'lakshya-sen-wins-kumamoto-masters-super-500-nov-16-2026',
    summary: 'Sen outlasted local favourite Koki Watanabe to successfully defend his Super 500 crown in Kumamoto, capping a strong week for Indian racquet sports.',
    content_html: `<p>KUMAMOTO — Indian shuttler Lakshya Sen captured his second consecutive Kumamoto Masters Japan Super 500 title, dismantling home challenger Koki Watanabe with sharp net play and relentless defensive retrieval.</p>
<p>Elsewhere in international sport, European domestic football officials issued disciplinary rulings in Spain’s Segunda División as leagues entered a dense pre-winter fixture schedule.</p>`,
    featured_image_url: '/assets/news/lakshya-sen-badminton.jpg',
    image_caption: 'Indian badminton star Lakshya Sen (right) during international singles match play.',
    image_credit: 'Wikimedia Austria / CC BY-SA 3.0',
    author_slug: 'arjun-deshmukh',
    category_slug: 'sports',
    tags: ['Badminton', 'Lakshya Sen', 'Sports'],
    featured_slot: null,
    is_featured: 0,
    is_breaking: 0,
    published_at: '2026-11-16T02:00:00.000Z',
  },
  {
    title: 'Chokepoints and Clean Air: Why Structural Planning Must Outpace Crisis Management',
    subheadline: 'From Gulf maritime corridors to Delhi’s winter airshed, deferred reform turns predictable risks into recurring emergencies.',
    slug: 'chokepoints-clean-air-structural-planning-opinion-nov-16-2026',
    summary: 'Whether guarding sea lanes near Hormuz, preparing deltas for Cyclone Akvan, or curbing urban traffic exhaust, long-term capacity matters far more than emergency optics.',
    content_html: `<p>Two starkly different stories on Monday—tanker rerouting near the Strait of Hormuz and the Supreme Court’s rebuke over Delhi’s choking winter air—carry an identical civic lesson: systems built only for calm weather fail abruptly under predictable strain.</p>
<p>Just as seasonal fire-fighting around crop residue cannot replace clean metropolitan transit across Delhi, Gurugram, and Noida, last-minute emergency shipping escorts cannot substitute for resilient energy inventories and regional de-escalation.</p>`,
    featured_image_url: '/assets/news/delhi-winter-smog.jpg',
    image_caption: 'Dense November particulate smog envelops buildings across the Delhi–Gurugram National Capital Region.',
    image_credit: 'Wikimedia Commons / CC BY-SA 4.0',
    author_slug: 'vikramaditya-sen',
    category_slug: 'opinion',
    tags: ['Policy', 'Urban Transit', 'Energy Security', 'Opinion'],
    featured_slot: null,
    is_featured: 0,
    is_breaking: 0,
    published_at: '2026-11-16T01:45:00.000Z',
  },
  {
    title: 'The Cost of Delay: From Severe Air to Fragile Ceasefires',
    subheadline: 'Half-measures in pollution governance and stalled diplomacy across Eastern Europe and West Asia leave citizens bearing the heaviest price.',
    slug: 'cost-of-delay-severe-air-fragile-ceasefires-editorial-nov-16-2026',
    summary: 'As Cyclone Akvan approaches India’s eastern shore and global talks falter over security guarantees and humanitarian access, public institutions face an urgent test of credibility.',
    content_html: `<p>Across this Monday’s news—from the Supreme Court’s pointed reminder on Delhi’s transport-driven air crisis to stalled virtual peace discussions over Ukraine and desperate appeals for winter shelter in Gaza—the cost of institutional postponement is painfully visible.</p>
<p>In New Delhi, judicial scrutiny has rightly forced attention back onto structural emissions rather than annual headlines; on the eastern coast, early evacuation readiness ahead of Cyclone Akvan illustrates what timely scientific warning and public coordination can achieve when acted upon early.</p>
<blockquote>"Credible governance is measured not by the volume of emergency proclamations, but by whether ordinary citizens are protected before crisis strikes."</blockquote>
<p>Abroad, genuine diplomacy in Europe and West Asia demands enforceable humanitarian access and security frameworks that address civilians’ winter survival before geopolitical bargaining consumes another season.</p>`,
    featured_image_url: '/assets/news/un-diplomacy-hall.jpg',
    image_caption: 'The United Nations Security Council chamber as international bodies confront protracted humanitarian and ceasefire deadlocks.',
    image_credit: 'Wikimedia Commons / CC BY-SA 2.0',
    author_slug: 'editorial-board',
    category_slug: 'editorial',
    tags: ['Editorial', 'Public Governance', 'Diplomacy'],
    featured_slot: null,
    is_featured: 0,
    is_breaking: 0,
    published_at: '2026-11-16T01:30:00.000Z',
  },
];

export function applyNov16NewsEdition(db: DatabaseSync): void {
  const existingFlag = db
    .prepare("SELECT value_json FROM site_settings WHERE key = 'news_edition_version'")
    .get() as { value_json: string } | undefined;

  if (existingFlag) {
    try {
      if (JSON.parse(existingFlag.value_json) === NOV16_EDITION_VERSION) {
        return;
      }
    } catch {
      // Proceed to apply update if malformed
    }
  }

  const now = new Date().toISOString();
  const categories = db.prepare('SELECT id, slug FROM categories').all() as Array<{ id: string; slug: string }>;
  const authors = db.prepare('SELECT id, slug FROM authors').all() as Array<{ id: string; slug: string }>;
  const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c.id]));
  const authorBySlug = Object.fromEntries(authors.map((a) => [a.slug, a.id]));

  if (Object.keys(catBySlug).length === 0 || Object.keys(authorBySlug).length === 0) {
    return;
  }

  db.exec('BEGIN;');
  try {
    // Archive legacy generic template slugs and clear old breaking/featured slots so today's edition leads cleanly
    const archiveStmt = db.prepare(
      `UPDATE articles
       SET status = 'archived', is_featured = 0, featured_slot = NULL, is_breaking = 0, updated_at = ?
       WHERE slug = ?`
    );
    for (const legacySlug of LEGACY_TEMPLATE_SLUGS) {
      archiveStmt.run(now, legacySlug);
    }

    db.prepare('UPDATE articles SET is_featured = 0, featured_slot = NULL, is_breaking = 0').run();

    const findBySlug = db.prepare('SELECT id FROM articles WHERE slug = ?');
    const insertArticle = db.prepare(`
      INSERT INTO articles (
        id, title, subheadline, slug, summary, content_html, featured_image_url,
        image_caption, image_credit, author_id, category_id, tags_json,
        seo_title, seo_description, status, approval_status, is_featured,
        featured_slot, is_breaking, scheduled_at, published_at, updated_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 'approved', ?, ?, ?, NULL, ?, ?, ?)
    `);

    const updateArticle = db.prepare(`
      UPDATE articles
      SET title = ?, subheadline = ?, summary = ?, content_html = ?,
          featured_image_url = ?, image_caption = ?, image_credit = ?,
          author_id = ?, category_id = ?, tags_json = ?,
          seo_title = ?, seo_description = ?, status = 'published', approval_status = 'approved',
          is_featured = ?, featured_slot = ?, is_breaking = ?, published_at = ?, updated_at = ?
      WHERE slug = ?
    `);

    for (const art of NOV16_NEWS_ARTICLES) {
      const categoryId = catBySlug[art.category_slug];
      const authorId = authorBySlug[art.author_slug] || authors[0].id;
      if (!categoryId) continue;

      const existing = findBySlug.get(art.slug) as { id: string } | undefined;
      if (existing) {
        updateArticle.run(
          art.title,
          art.subheadline,
          art.summary,
          art.content_html,
          art.featured_image_url,
          art.image_caption,
          art.image_credit,
          authorId,
          categoryId,
          JSON.stringify(art.tags),
          `${art.title} | THE CONTINENTAL`,
          art.summary,
          art.is_featured,
          art.featured_slot,
          art.is_breaking,
          art.published_at,
          now,
          art.slug
        );
      } else {
        insertArticle.run(
          randomUUID(),
          art.title,
          art.subheadline,
          art.slug,
          art.summary,
          art.content_html,
          art.featured_image_url,
          art.image_caption,
          art.image_credit,
          authorId,
          categoryId,
          JSON.stringify(art.tags),
          `${art.title} | THE CONTINENTAL`,
          art.summary,
          art.is_featured,
          art.featured_slot,
          art.is_breaking,
          art.published_at,
          now,
          now
        );
      }
    }

    db.prepare(
      `INSERT INTO site_settings (key, value_json, updated_at)
       VALUES ('news_edition_version', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`
    ).run(JSON.stringify(NOV16_EDITION_VERSION), now);

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
