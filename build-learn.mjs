// Generates an SEO landing page per compound into /learn, plus /learn/index.html and sitemap.xml.
// Run: node build-learn.mjs   (re-run whenever the knowledge base changes)
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";

const API = "https://pmebegdwqizozfmzxpuw.supabase.co/functions/v1/peptx-cards-export";
const ORIGIN = "https://peptx.ai";
const OUT = "learn";

const CAT = {"Weight Management":"#30D158","Healing & Recovery":"#0A84FF","Growth Hormone":"#BF5AF2","Metabolic & Exercise":"#2CD4C4","Anti-Aging & Skin":"#FF375F","Sexual Health":"#FF453A","Cognitive Enhancement":"#64D2FF","Immune Support":"#5E5CE6","Muscle Growth":"#FF9F0A","Hormone Support":"#FFD60A","Anti-Inflammatory":"#66D4CF","Sleep & Recovery":"#7D7AFF","Cosmetic":"#FF6EC7"};
const GR = {A:{c:"#FFD60A",l:"Clinical"},B:{c:"#64D2FF",l:"Emerging"},C:{c:"#C9A26B",l:"Early research"}};
const REG = {research_compound:"Research compound",prescription_only:"Prescription (clinical)",emerging:"Emerging / in trials",licensed:"Licensed",approved:"Approved"};
const catCol = c => CAT[c] || "#8E9BB3";
const slugify = s => (s||"").toLowerCase().replace(/\+/g," plus ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
const esc = s => String(s==null?"":s).replace(/\s—\s/g,", ").replace(/—/g,", ").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const cap = s => (s||"").replace(/^./,c=>c.toUpperCase());
function hl(h){h=parseFloat(h);if(!h)return"n/a";return h>=24?(+(h/24).toFixed(h%24?1:0))+(h>=48?" days":" day"):h+" hrs";}
function fmtT(h){h=parseFloat(h);if(isNaN(h))return"n/a";if(h<1)return Math.round(h*60)+" min";if(h<24)return (+h)+" hrs";const d=h/24;return (Number.isInteger(d)?d:+d.toFixed(1))+(d>=2?" days":" day");}
function usesOf(p){const u=[];if(p.longevity_relevance)u.push(["Longevity",p.longevity_relevance]);if(p.fitness_relevance)u.push(["Fitness",p.fitness_relevance]);if(p.health_optimisation_relevance)u.push(["Health optimisation",p.health_optimisation_relevance]);return u;}

function refHTML(r){
  const meta=[r.authors,r.year].filter(Boolean).join(", ");
  const pmid=r.pubmed_id?String(r.pubmed_id).replace(/\D/g,""):"";
  const url=r.doi?("https://doi.org/"+r.doi):(pmid?("https://pubmed.ncbi.nlm.nih.gov/"+pmid+"/"):null);
  return `<div class="ref"><div class="rt">${esc(r.title||"Reference")}</div>${r.one_line_summary?`<div class="rs">${esc(r.one_line_summary)}</div>`:""}<div class="rm">${esc(meta)}${url?`${meta?" · ":""}<a href="${esc(url)}" target="_blank" rel="noopener nofollow">View source</a>`:""}</div></div>`;
}
function chips(arr,pfx){return (arr||[]).map(s=>`<span>${pfx||""}${esc(s)}</span>`).join("");}

function page(p, all){
  const acc=catCol(p.category), g=GR[p.evidence_grade]||GR.C, slug=slugify(p.name);
  const uses=usesOf(p);
  const refs=p.key_research_refs||[];
  const reg=[["UK",p.regulatory_status_uk],["US",p.regulatory_status_us],["EU",p.regulatory_status_eu]].filter(r=>r[1]);
  const facts=[
    p.administration&&p.administration.length?["Route",p.administration.join("/")]:["Route",cap(p.absorption_route)],
    p.freq?["Frequency",p.freq]:null,
    p.dose_range?["Typical range",p.dose_range]:null,
    p.cycle_duration?["Cycle",p.cycle_duration]:null,
    ["Half-life",hl(p.half_life_hours)],
    ["Onset",fmtT(p.tmax)],
  ].filter(Boolean);
  const related=all.filter(x=>x.category===p.category && x.name!==p.name).slice(0,6);
  const aliases=(p.aliases||[]).filter(Boolean);
  const desc=`${p.name}${p.full_name?` (${p.full_name})`:""}: ${(p.tldr||p.description||"").slice(0,150)} Evidence grade ${p.evidence_grade}. Research use only.`;
  const title=`${p.name}${p.nick?` — ${p.nick}`:""}: evidence, mechanism, dosing & PK | PeptX.AI`;

  const ld={
    "@context":"https://schema.org","@graph":[
     {"@type":"BreadcrumbList","itemListElement":[
       {"@type":"ListItem","position":1,"name":"PeptX.AI","item":ORIGIN+"/"},
       {"@type":"ListItem","position":2,"name":"Compounds","item":ORIGIN+"/cards.html"},
       {"@type":"ListItem","position":3,"name":p.name,"item":`${ORIGIN}/${OUT}/${slug}`}]},
     {"@type":["Drug","MedicalEntity"],"name":p.name,"alternateName":[p.full_name,...aliases].filter(Boolean),
      "description":(p.description||p.tldr||"").slice(0,300),
      "legalStatus":REG[p.regulatory_status_uk]||p.regulatory_status_uk,
      "mechanismOfAction":p.mechanism_of_action||undefined},
     {"@type":"MedicalWebPage","name":title,"description":desc,"url":`${ORIGIN}/${OUT}/${slug}`,"lastReviewed":new Date().toISOString().slice(0,10)}
    ]};

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"/>
<meta name="keywords" content="${esc([p.name,p.full_name,...aliases,p.category,"peptide research","evidence","dosing","pharmacokinetics","biohacking"].filter(Boolean).join(", "))}"/>
<meta name="robots" content="index,follow"/>
<meta name="theme-color" content="#04060b"/>
<link rel="canonical" href="${ORIGIN}/${OUT}/${slug}"/>
<meta property="og:site_name" content="PeptX.AI"/>
<meta property="og:type" content="article"/>
<meta property="og:title" content="${esc(p.name+(p.nick?` — ${p.nick}`:""))}"/>
<meta property="og:description" content="${esc((p.tldr||p.description||"").slice(0,180))}"/>
<meta property="og:url" content="${ORIGIN}/${OUT}/${slug}"/>
<meta property="og:image" content="${ORIGIN}/og.png"/>
<meta name="twitter:card" content="summary_large_image"/>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='9' fill='%230b111c'/%3E%3Cdefs%3E%3ClinearGradient id='s' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%23f4f8ff'/%3E%3Cstop offset='.5' stop-color='%239fb0c4'/%3E%3Cstop offset='1' stop-color='%2346546a'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M8 9H14L32 31H26Z M32 9H26L8 31H14Z' fill='url(%23s)'/%3E%3C/svg%3E"/>
<link rel="preconnect" href="https://api.fontshare.com" crossorigin>
<link href="https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&f[]=satoshi@400,500,600,700&f[]=jetbrains-mono@500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/learn/learn.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body style="--accent:${acc};--gcol:${g.c}">
<div class="scene"></div><div class="smk smk1"></div><div class="smk smk2"></div><div class="grain"></div>
<nav><div class="navin">
  <a class="brand" href="/"><svg class="bmark" viewBox="0 0 144 40" role="img" aria-label="PeptX.AI" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".16" stop-color="#eef2f8"/><stop offset=".47" stop-color="#b9c3d2"/><stop offset=".53" stop-color="#76829a"/><stop offset=".74" stop-color="#aab6c6"/><stop offset="1" stop-color="#e2e8f1"/></linearGradient><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a7ffee"/><stop offset=".5" stop-color="#00d4aa"/><stop offset="1" stop-color="#15917a"/></linearGradient><linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient><filter id="lf" x="-6%" y="-14%" width="112%" height="146%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000" flood-opacity=".6"/></filter></defs><g filter="url(#lf)" font-family="'Clash Display',sans-serif" font-weight="700" font-size="33" letter-spacing="-1.3"><text x="1.5" y="30" fill="url(#ag)">PeptX<tspan fill="url(#tg)">.AI</tspan></text><text x="1.5" y="30" fill="url(#sh)">PeptX.AI</text></g></svg></a>
  <div class="navr"><a class="lk" href="/cards.html">All compounds</a><a class="lk go" href="/cards.html?ask=1">Ask the AI</a></div>
</div></nav>

<main class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/cards.html">Compounds</a><span>›</span><span>${esc(p.name)}</span></nav>

  <header class="phero">
    <div class="ptop"><span class="pcat"><span class="d"></span>${esc(p.category)}</span><span class="pgrade">Grade ${esc(p.evidence_grade)} · ${esc(g.l)}</span></div>
    <h1>${esc(p.name)}</h1>
    <div class="psub">${esc(p.full_name||"")}${p.nick?` · <b>${esc(p.nick)}</b>`:""}${aliases.length?` · <span class="al">also: ${esc(aliases.join(", "))}</span>`:""}</div>
    ${p.is_peptide===false?`<div class="warn">${esc(p.compound_class)} — grouped with peptides for research convenience; not technically a peptide.</div>`:""}
    <p class="lede">${esc(p.tldr||p.description)}</p>
    <div class="herobtns">
      <a class="btn accent" href="/cards.html?card=${encodeURIComponent(p.name)}">Open the card</a>
      <a class="btn ghost" href="/calculator.html?c=${encodeURIComponent(p.name)}">Dose calculator</a>
      <a class="btn ghost" href="/cards.html?ask=1">Ask the AI about ${esc(p.name)}</a>
      <a class="btn ghost" href="/account.html">+ Add to my profile</a>
    </div>
  </header>

  <section class="facts">${facts.map(([k,v])=>`<div class="fact"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</section>

  <div class="grid">
    <article class="body">
      <section><h2>Overview</h2><p>${esc(p.description)}</p></section>
      ${p.mechanism_of_action?`<section><h2>How it works</h2><p>${esc(p.mechanism_of_action)}</p></section>`:""}
      ${(p.primary_effects&&p.primary_effects.length)?`<section><h2>What the research describes</h2><ul class="ticks">${p.primary_effects.map(e=>`<li>${esc(e)}</li>`).join("")}</ul></section>`:""}
      ${uses.length?`<section><h2>Use areas</h2><p class="muted">${esc(p.name)} is researched across multiple areas:</p><div class="uses">${uses.map(u=>`<div class="useitem"><h3>${esc(u[0])}</h3><p>${esc(u[1])}</p></div>`).join("")}</div></section>`:""}
      ${p.evidence_summary?`<section><h2>Evidence summary</h2><p>${esc(p.evidence_summary)}</p><p class="grade-line"><b>Evidence grade ${esc(p.evidence_grade)}</b> — ${esc(g.l)}.</p></section>`:""}
      ${refs.length?`<section><h2>Research references</h2>${refs.map(refHTML).join("")}</section>`:""}
      <section><h2>Pharmacokinetics</h2><div class="kv">
        <div><span>Half-life</span><b>${esc(hl(p.half_life_hours))}</b></div>
        <div><span>Onset (t-max)</span><b>${esc(fmtT(p.tmax))}</b></div>
        <div><span>Route</span><b>${esc(p.administration&&p.administration.length?p.administration.join("/"):cap(p.absorption_route))}</b></div>
        <div><span>Frequency</span><b>${esc(p.freq||"n/a")}</b></div>
        ${p.dose_range?`<div><span>Typical range</span><b>${esc(p.dose_range)}</b></div>`:""}
        ${p.cycle_duration?`<div><span>Cycle</span><b>${esc(p.cycle_duration)}</b></div>`:""}
      </div>${p.dosing_notes?`<p class="muted" style="margin-top:12px">${esc(p.dosing_notes)}</p>`:""}</section>
      ${reg.length?`<section><h2>Regulatory status</h2><div class="chips">${reg.map(r=>`<span><b>${r[0]}</b> · ${esc(REG[r[1]]||r[1])}</span>`).join("")}</div>${p.regulatory_note?`<p class="muted" style="margin-top:10px">${esc(p.regulatory_note)}</p>`:""}</section>`:""}
      ${((p.side_effects_common&&p.side_effects_common.length)||(p.side_effects_rare&&p.side_effects_rare.length)||(p.contraindications&&p.contraindications.length)||(p.drug_interactions&&p.drug_interactions.length))?`<section><h2>Safety &amp; tolerability</h2>
        ${p.side_effects_common&&p.side_effects_common.length?`<h3>Commonly noted in studies</h3><div class="chips">${chips(p.side_effects_common)}</div>`:""}
        ${p.side_effects_rare&&p.side_effects_rare.length?`<h3>Less common</h3><div class="chips">${chips(p.side_effects_rare)}</div>`:""}
        ${p.contraindications&&p.contraindications.length?`<h3>Contraindications</h3><ul class="ticks warn">${p.contraindications.map(s=>`<li>${esc(s)}</li>`).join("")}</ul>`:""}
        ${p.drug_interactions&&p.drug_interactions.length?`<h3>Interactions noted</h3><ul class="ticks warn">${p.drug_interactions.map(s=>`<li>${esc(s)}</li>`).join("")}</ul>`:""}
      </section>`:""}
      ${(p.synergistic_compounds&&p.synergistic_compounds.length)?`<section><h2>Researched alongside</h2><div class="chips">${p.synergistic_compounds.map(s=>`<a class="chiplink" href="/learn/${slugify(s)}.html">+ ${esc(s)}</a>`).join("")}</div></section>`:""}
      <div class="disc"><b>Research use only.</b> This is an educational summary of published research about ${esc(p.name)} — not medical, health, diagnostic or dosing advice, and not a substitute for a qualified professional. All compounds are referenced strictly for laboratory and research use only.</div>
    </article>

    <aside class="side">
      <div class="scard">
        <div class="sgrade" style="background:${g.c}">${esc(p.evidence_grade)}</div>
        <div class="sg"><b>Evidence grade ${esc(p.evidence_grade)}</b><span>${esc(g.l)}</span></div>
      </div>
      <div class="scard col">
        <h4>At a glance</h4>
        ${facts.slice(0,6).map(([k,v])=>`<div class="srow"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}
      </div>
      <a class="scta" href="/cards.html?card=${encodeURIComponent(p.name)}">Explore as a card →</a>
      ${related.length?`<div class="scard col"><h4>Related compounds</h4>${related.map(r=>`<a class="rel" href="/learn/${slugify(r.name)}.html"><span class="rd" style="background:${catCol(r.category)}"></span>${esc(r.name)}<small>${esc(r.evidence_grade)}</small></a>`).join("")}</div>`:""}
    </aside>
  </div>
</main>

<footer class="site"><div class="wrap fin">
  <a class="brand" href="/"><svg class="bmark" viewBox="0 0 144 40" role="img" aria-label="PeptX.AI" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".16" stop-color="#eef2f8"/><stop offset=".47" stop-color="#b9c3d2"/><stop offset=".53" stop-color="#76829a"/><stop offset=".74" stop-color="#aab6c6"/><stop offset="1" stop-color="#e2e8f1"/></linearGradient><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a7ffee"/><stop offset=".5" stop-color="#00d4aa"/><stop offset="1" stop-color="#15917a"/></linearGradient><linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient><filter id="lf" x="-6%" y="-14%" width="112%" height="146%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000" flood-opacity=".6"/></filter></defs><g filter="url(#lf)" font-family="'Clash Display',sans-serif" font-weight="700" font-size="33" letter-spacing="-1.3"><text x="1.5" y="30" fill="url(#ag)">PeptX<tspan fill="url(#tg)">.AI</tspan></text><text x="1.5" y="30" fill="url(#sh)">PeptX.AI</text></g></svg></a>
  <div class="flinks"><a href="/cards.html">Compounds</a><a href="/learn/">All guides</a><a href="/calculator.html">Calculator</a><a href="/cards.html?ask=1">Ask AI</a><a href="/terms.html">Terms</a><a href="/privacy.html">Privacy</a></div>
  <span class="ruo">Research use only</span>
</div></footer></body>
</html>`;
}

function indexPage(all){
  const byCat={};
  all.forEach(p=>{(byCat[p.category]=byCat[p.category]||[]).push(p);});
  const cats=Object.keys(byCat).sort();
  const sections=cats.map(c=>`<section class="lcat"><h2><span class="d" style="background:${catCol(c)}"></span>${esc(c)} <small>${byCat[c].length}</small></h2>
    <div class="lgrid">${byCat[c].sort((a,b)=>a.name.localeCompare(b.name)).map(p=>`<a class="lcard" href="/learn/${slugify(p.name)}.html"><div class="lt"><b>${esc(p.name)}</b><span class="lg" style="background:${(GR[p.evidence_grade]||GR.C).c}">${esc(p.evidence_grade)}</span></div><span class="ln">${esc(p.nick||p.full_name||"")}</span><span class="lp">${esc((p.tldr||"").slice(0,84))}${(p.tldr||"").length>84?"…":""}</span></a>`).join("")}</div></section>`).join("");
  const desc=`Browse every peptide and research compound in the PeptX.AI knowledge base — ${all.length} evidence-graded guides covering mechanism, pharmacokinetics, dosing ranges and the research. Research use only.`;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Peptide &amp; Compound Guides — ${all.length} evidence-graded research guides | PeptX.AI</title>
<meta name="description" content="${esc(desc)}"/>
<meta name="robots" content="index,follow"/><meta name="theme-color" content="#04060b"/>
<link rel="canonical" href="${ORIGIN}/learn/"/>
<meta property="og:title" content="Peptide &amp; Compound Guides | PeptX.AI"/><meta property="og:description" content="${esc(desc)}"/><meta property="og:type" content="website"/><meta property="og:url" content="${ORIGIN}/learn/"/>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='9' fill='%230b111c'/%3E%3Cdefs%3E%3ClinearGradient id='s' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%23f4f8ff'/%3E%3Cstop offset='.5' stop-color='%239fb0c4'/%3E%3Cstop offset='1' stop-color='%2346546a'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M8 9H14L32 31H26Z M32 9H26L8 31H14Z' fill='url(%23s)'/%3E%3C/svg%3E"/>
<link rel="preconnect" href="https://api.fontshare.com" crossorigin>
<link href="https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&f[]=satoshi@400,500,600,700&f[]=jetbrains-mono@500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/learn/learn.css">
</head><body>
<div class="scene"></div><div class="smk smk1"></div><div class="smk smk2"></div><div class="grain"></div>
<nav><div class="navin"><a class="brand" href="/"><svg class="bmark" viewBox="0 0 144 40" role="img" aria-label="PeptX.AI" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".16" stop-color="#eef2f8"/><stop offset=".47" stop-color="#b9c3d2"/><stop offset=".53" stop-color="#76829a"/><stop offset=".74" stop-color="#aab6c6"/><stop offset="1" stop-color="#e2e8f1"/></linearGradient><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a7ffee"/><stop offset=".5" stop-color="#00d4aa"/><stop offset="1" stop-color="#15917a"/></linearGradient><linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient><filter id="lf" x="-6%" y="-14%" width="112%" height="146%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000" flood-opacity=".6"/></filter></defs><g filter="url(#lf)" font-family="'Clash Display',sans-serif" font-weight="700" font-size="33" letter-spacing="-1.3"><text x="1.5" y="30" fill="url(#ag)">PeptX<tspan fill="url(#tg)">.AI</tspan></text><text x="1.5" y="30" fill="url(#sh)">PeptX.AI</text></g></svg></a><div class="navr"><a class="lk" href="/cards.html">Swipe the deck</a><a class="lk go" href="/cards.html?ask=1">Ask the AI</a></div></div></nav>
<main class="wrap">
  <nav class="crumbs"><a href="/">Home</a><span>›</span><span>Guides</span></nav>
  <header class="lhead"><h1>Peptide &amp; compound guides</h1><p>Every compound in the knowledge base — ${all.length} evidence-graded research guides. Tap any to read the mechanism, pharmacokinetics, evidence and references.</p></header>
  ${sections}
  <div class="disc"><b>Research use only.</b> Educational summaries of published research — not medical advice.</div>
</main>
<footer class="site"><div class="wrap fin"><a class="brand" href="/"><svg class="bmark" viewBox="0 0 144 40" role="img" aria-label="PeptX.AI" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".16" stop-color="#eef2f8"/><stop offset=".47" stop-color="#b9c3d2"/><stop offset=".53" stop-color="#76829a"/><stop offset=".74" stop-color="#aab6c6"/><stop offset="1" stop-color="#e2e8f1"/></linearGradient><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a7ffee"/><stop offset=".5" stop-color="#00d4aa"/><stop offset="1" stop-color="#15917a"/></linearGradient><linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient><filter id="lf" x="-6%" y="-14%" width="112%" height="146%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000" flood-opacity=".6"/></filter></defs><g filter="url(#lf)" font-family="'Clash Display',sans-serif" font-weight="700" font-size="33" letter-spacing="-1.3"><text x="1.5" y="30" fill="url(#ag)">PeptX<tspan fill="url(#tg)">.AI</tspan></text><text x="1.5" y="30" fill="url(#sh)">PeptX.AI</text></g></svg></a><div class="flinks"><a href="/cards.html">Compounds</a><a href="/calculator.html">Calculator</a><a href="/cards.html?ask=1">Ask AI</a><a href="/terms.html">Terms</a><a href="/privacy.html">Privacy</a></div><span class="ruo">Research use only</span></div></footer></body></html>`;
}

const CSS = `:root{--bg:#04060b;--ink:#f4f6fc;--muted:#9aa3b6;--accent:#00d4aa;--blue:#0a84ff;--glass:rgba(255,255,255,.05);--glass2:rgba(255,255,255,.09);--hair:rgba(255,255,255,.13);--hair2:rgba(255,255,255,.07);--display:'Clash Display',sans-serif;--body:'Satoshi',sans-serif;--mono:'JetBrains Mono',monospace}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:var(--body);color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased;line-height:1.6;overflow-x:hidden}
a{color:inherit;text-decoration:none}
::selection{background:rgba(0,212,170,.3)}
.scene{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(60% 42% at 50% -4%,rgba(150,180,228,.20),transparent 56%),radial-gradient(130% 100% at 50% 0%,#0c1119 0%,#080b13 42%,#04060b 100%)}
.scene::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.45;background:repeating-linear-gradient(92deg,rgba(255,255,255,.018) 0 1px,transparent 1px 4px)}
.smk{position:fixed;inset:0;z-index:0;pointer-events:none;background-position:center;background-repeat:no-repeat;background-size:cover;will-change:transform}
.smk1{opacity:.62;mix-blend-mode:screen;-webkit-mask:radial-gradient(66% 54% at 50% 36%,transparent 6%,#000 70%);mask:radial-gradient(66% 54% at 50% 36%,transparent 6%,#000 70%);background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='1280' height='800'><filter id='b'><feTurbulence type='fractalNoise' baseFrequency='0.005 0.007' numOctaves='5' seed='11' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.15 0 0 0 0 0.43 0 0 0 0 0.95 1 0 0 0 -0.18'/></filter><rect width='1280' height='800' filter='url(%23b)'/></svg>");animation:drift1 90s ease-in-out infinite}
.smk2{opacity:.4;mix-blend-mode:screen;-webkit-mask:radial-gradient(80% 64% at 50% 42%,transparent 14%,#000 86%);mask:radial-gradient(80% 64% at 50% 42%,transparent 14%,#000 86%);background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='1280' height='800'><filter id='w'><feTurbulence type='fractalNoise' baseFrequency='0.013 0.017' numOctaves='5' seed='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.72 0 0 0 0 0.82 0 0 0 0 1 1.2 0 0 0 -0.68'/></filter><rect width='1280' height='800' filter='url(%23w)'/></svg>");animation:drift2 120s ease-in-out infinite}
@keyframes drift1{0%,100%{transform:translate3d(-2%,0,0) scale(1.06)}50%{transform:translate3d(3%,-3%,0) scale(1.14)}}
@keyframes drift2{0%,100%{transform:translate3d(2%,1%,0) scale(1.10)}50%{transform:translate3d(-3%,-2%,0) scale(1.20)}}
@media(prefers-reduced-motion:reduce){.smk{animation:none!important}}
.grain{position:fixed;inset:0;z-index:1;pointer-events:none;opacity:.05;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.wrap{position:relative;z-index:2;max-width:1080px;margin:0 auto;padding:0 clamp(16px,4vw,32px)}
nav{position:sticky;top:0;z-index:30;backdrop-filter:blur(16px);background:linear-gradient(180deg,rgba(4,6,11,.82),rgba(4,6,11,.3));border-bottom:1px solid var(--hair2)}
.navin{max-width:1080px;margin:0 auto;height:60px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(16px,4vw,32px)}
.brand{display:flex;align-items:center;gap:9px;font-family:var(--display);font-weight:700;font-size:18px;color:var(--ink)}
.logo{width:30px;height:30px;border-radius:8px;position:relative;overflow:hidden;background:#0b111c;border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 4px 12px -5px rgba(0,0,0,.7)}
.logo::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,#f6f9ff,#a7b6c9 46%,#46546a);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Cpath d='M5 4H14L35 36H26Z'/%3E%3Cpath d='M35 4H26L5 36H14Z'/%3E%3C/svg%3E") center/60% no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Cpath d='M5 4H14L35 36H26Z'/%3E%3Cpath d='M35 4H26L5 36H14Z'/%3E%3C/svg%3E") center/60% no-repeat}
.brand i{font-style:normal;color:var(--accent)}
.blogo{height:28px;width:auto;display:block;filter:drop-shadow(0 2px 6px rgba(0,0,0,.5))}
.bmark{height:27px;width:auto;display:block}
.brand .ai{font-family:var(--display);font-weight:600;font-size:18px;letter-spacing:-.01em;color:var(--accent);margin-left:-2px}
.navr{display:flex;gap:8px;align-items:center}
.lk{font-weight:600;font-size:13.5px;color:var(--muted);padding:8px 13px;border-radius:10px}
.lk:hover{color:var(--ink);background:var(--glass)}
.lk.go{color:var(--accent)}
.crumbs{display:flex;gap:9px;align-items:center;font-size:13px;color:var(--muted);padding:22px 0 4px}
.crumbs a:hover{color:var(--ink)}.crumbs span{opacity:.6}
.phero{padding:14px 0 8px;border-bottom:1px solid var(--hair2)}
.ptop{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
.pcat{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:#c3cadb}
.pcat .d{width:9px;height:9px;border-radius:50%;background:var(--accent);box-shadow:0 0 10px var(--accent)}
.pgrade{font-family:var(--mono);font-size:12px;color:var(--muted)}
h1{font-family:var(--display);font-weight:600;font-size:clamp(34px,7vw,62px);letter-spacing:-.03em;line-height:1.02;margin:16px 0 0;
  background:linear-gradient(120deg,#fff,var(--accent));-webkit-background-clip:text;background-clip:text;color:transparent}
.psub{font-family:var(--mono);font-size:13.5px;color:var(--muted);margin-top:12px}
.psub b{color:var(--accent);font-family:var(--body);font-weight:600}.psub .al{color:#8893a6}
.warn{margin-top:16px;font-size:13.5px;color:#e9d27a;background:rgba(255,214,10,.08);border:1px solid rgba(255,214,10,.25);border-radius:12px;padding:12px 15px}
.lede{font-size:clamp(16px,2.4vw,19px);color:#d4dae7;margin-top:18px;max-width:64ch;line-height:1.6}
.herobtns{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}
.btn{font-weight:700;font-size:14.5px;padding:12px 20px;border-radius:13px;cursor:pointer;transition:.2s}
.btn.accent{color:#04060b;background:linear-gradient(160deg,#0a84ff,#00d4aa);box-shadow:0 12px 28px -12px #00d4aa99}
.btn.ghost{color:var(--ink);background:var(--glass);border:1px solid var(--hair)}
.btn.ghost:hover{background:var(--glass2)}
.facts{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin:26px 0}
.fact{background:linear-gradient(165deg,var(--glass2),var(--glass));border:1px solid var(--hair2);border-radius:14px;padding:14px}
.fact span{display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.fact b{display:block;font-family:var(--mono);font-weight:500;font-size:14px;margin-top:6px;color:#eef1f8}
@media(max-width:820px){.facts{grid-template-columns:1fr 1fr 1fr}}
@media(max-width:480px){.facts{grid-template-columns:1fr 1fr}}
.grid{display:grid;grid-template-columns:1fr 320px;gap:30px;align-items:start;padding-bottom:40px}
@media(max-width:860px){.grid{grid-template-columns:1fr}.side{order:-1}}
.body section{padding:24px 0;border-top:1px solid var(--hair2)}
.body section:first-child{border-top:none;padding-top:8px}
h2{font-family:var(--display);font-weight:600;font-size:23px;letter-spacing:-.01em;margin-bottom:12px}
h3{font-family:var(--display);font-weight:600;font-size:15px;margin:18px 0 9px;color:#dfe4ef}
.body p{color:#cdd4e3;font-size:15.5px;line-height:1.7}
.muted{color:var(--muted)!important;font-size:14px!important}
.grade-line{margin-top:12px}
.ticks{list-style:none;display:flex;flex-direction:column;gap:9px;margin-top:6px}
.ticks li{display:flex;gap:11px;font-size:15px;color:#d4dae7;line-height:1.5}
.ticks li::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--accent);margin-top:8px;flex:none;box-shadow:0 0 9px var(--accent)}
.ticks.warn li::before{background:#ffb84d;box-shadow:0 0 9px #ffb84d}
.uses{display:grid;gap:12px;margin-top:12px}
.useitem{background:rgba(255,255,255,.04);border:1px solid var(--hair2);border-radius:14px;padding:16px 18px}
.useitem h3{margin:0 0 6px;color:var(--accent)}
.useitem p{font-size:14.5px}
.kv{display:grid;grid-template-columns:1fr 1fr 1fr;gap:11px}
.kv>div{background:rgba(255,255,255,.045);border:1px solid var(--hair2);border-radius:13px;padding:12px 14px}
.kv span{display:block;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:5px}
.kv b{font-family:var(--mono);font-weight:500;font-size:14px}
@media(max-width:560px){.kv{grid-template-columns:1fr 1fr}}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chips span,.chiplink{font-size:13px;padding:7px 12px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid var(--hair2);color:#dde2ef}
.chips span b{color:#cfd6e6}
.chiplink:hover{border-color:var(--accent);color:var(--accent)}
.ref{margin-bottom:11px;padding:15px 17px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid var(--hair2)}
.ref .rt{font-weight:600;font-size:15px;color:#eef1f8;line-height:1.4}
.ref .rs{font-size:14px;color:#b9c1d2;margin-top:7px;line-height:1.5}
.ref .rm{font-size:12px;color:var(--muted);margin-top:9px;font-family:var(--mono)}
.ref .rm a{color:var(--accent)}
.disc{margin-top:24px;padding:16px 18px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid var(--hair2);font-size:12.5px;line-height:1.55;color:var(--muted)}
.disc b{color:#c7cedd}
.side{display:flex;flex-direction:column;gap:14px;position:sticky;top:78px}
@media(max-width:860px){.side{position:static}}
.scard{background:linear-gradient(165deg,var(--glass2),var(--glass));border:1px solid var(--hair);border-radius:18px;padding:18px;backdrop-filter:blur(12px)}
.scard.col{display:flex;flex-direction:column;gap:2px}
.scard h4{font-family:var(--display);font-weight:600;font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px}
.scard:not(.col){display:flex;align-items:center;gap:14px}
.sgrade{width:50px;height:50px;border-radius:14px;display:grid;place-items:center;font-family:var(--display);font-weight:700;font-size:24px;color:#04060b;flex:none}
.sg b{display:block;font-family:var(--display);font-weight:600;font-size:15px}.sg span{font-size:12.5px;color:var(--muted)}
.srow{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--hair2);font-size:13px}
.srow:last-child{border-bottom:none}.srow span{color:var(--muted)}.srow b{font-family:var(--mono);font-weight:500}
.scta{display:block;text-align:center;font-weight:700;font-size:14.5px;color:#04060b;background:linear-gradient(160deg,#0a84ff,#00d4aa);padding:14px;border-radius:14px;box-shadow:0 12px 28px -12px #00d4aa99}
.rel{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--hair2);font-weight:600;font-size:14px}
.rel:last-child{border-bottom:none}.rel:hover{color:var(--accent)}
.rel .rd{width:8px;height:8px;border-radius:50%;flex:none}.rel small{margin-left:auto;font-family:var(--mono);color:var(--muted)}
footer.site{position:relative;z-index:2;border-top:1px solid var(--hair2);margin-top:30px;padding:30px 0 60px}
.fin{display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between}
.flinks{display:flex;flex-wrap:wrap;gap:18px}.flinks a{color:#b7bfd0;font-size:14px}.flinks a:hover{color:var(--ink)}
.ruo{font-size:12px;font-weight:600;color:#e9d27a;background:rgba(255,214,10,.07);border:1px solid rgba(255,214,10,.22);padding:7px 13px;border-radius:100px}
.lhead{padding:18px 0 8px}.lhead h1{font-size:clamp(32px,6vw,52px)}.lhead p{color:#b7bfd0;font-size:16px;margin-top:14px;max-width:60ch}
.lcat{padding:30px 0 6px}.lcat h2{display:flex;align-items:center;gap:11px}.lcat h2 .d{width:11px;height:11px;border-radius:50%}.lcat h2 small{font-family:var(--mono);font-size:13px;color:var(--muted);font-weight:400}
.lgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:13px;margin-top:16px}
.lcard{border-radius:16px;padding:16px;background:linear-gradient(165deg,var(--glass2),var(--glass));border:1px solid var(--hair);transition:.2s;display:flex;flex-direction:column;gap:4px}
.lcard:hover{transform:translateY(-3px);border-color:var(--accent)}
.lt{display:flex;justify-content:space-between;align-items:center}.lt b{font-family:var(--display);font-weight:600;font-size:17px}
.lg{font-family:var(--display);font-weight:700;font-size:12px;width:23px;height:23px;border-radius:7px;display:grid;place-items:center;color:#04060b}
.ln{font-family:var(--mono);font-size:11px;color:var(--muted)}.lp{font-size:12.5px;color:#aeb7c9;margin-top:5px;line-height:1.4}
`;

(async()=>{
  const r=await fetch(API);
  const d=await r.json();
  const all=(d.cards||[]).filter(c=>c.name);
  mkdirSync(OUT,{recursive:true});
  writeFileSync(`${OUT}/learn.css`,CSS);
  let n=0;
  const stripDash = s => s.replace(/\s—\s/g,", ").replace(/—/g,", ");
  for(const p of all){ writeFileSync(`${OUT}/${slugify(p.name)}.html`, stripDash(page(p,all))); n++; }
  writeFileSync(`${OUT}/index.html`, stripDash(indexPage(all)));

  // sitemap
  const urls=[
    ["/","1.0","weekly"],["/cards.html","0.9","weekly"],["/learn/","0.9","weekly"],["/calculator.html","0.9","weekly"],
    ["/chat.html","0.6","monthly"],["/terms.html","0.3","yearly"],["/privacy.html","0.3","yearly"],
    ...all.map(p=>[`/learn/${slugify(p.name)}`,"0.8","monthly"])
  ];
  const sm=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`+
    urls.map(([u,pr,cf])=>`  <url><loc>${ORIGIN}${u}</loc><changefreq>${cf}</changefreq><priority>${pr}</priority></url>`).join("\n")+
    `\n</urlset>\n`;
  writeFileSync("sitemap.xml",sm);
  console.log(`Generated ${n} compound guides + index + sitemap (${urls.length} urls).`);
})();
