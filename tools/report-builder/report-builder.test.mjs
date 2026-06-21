import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildEmailPlan,
  buildOpportunityCards,
  enrichOpportunity,
  hasRevenueProof,
  isNearDuplicate,
  isPublishableCandidate,
  primarySection,
} from './report-builder.mjs'

const recentTime = new Date(Date.now() - 24 * 36e5).toISOString()

function candidate(overrides = {}) {
  return {
    id: '1',
    source_type: 'x',
    source: '@builder',
    tier: 'A',
    title: 'Builder launched an AI coding agent workflow',
    url: 'https://example.com/item',
    published_at: recentTime,
    summary: 'The builder launched an AI coding agent workflow, tested it with 20 users, and documented the deployment steps and results.',
    tags: ['Codex/AI编程'],
    ...overrides,
  }
}

test('rejects stale daily-report material', () => {
  const stale = candidate({ published_at: new Date(Date.now() - 10 * 24 * 36e5).toISOString() })
  assert.equal(isPublishableCandidate(stale), false)
})

test('requires an actual monetary amount for revenue proof', () => {
  assert.equal(hasRevenueProof(candidate({ summary: 'The product is used by 13% of a startup batch and may generate revenue.' })), false)
  assert.equal(hasRevenueProof(candidate({ summary: 'The platform found $18M in unmanaged meeting spend for customers.' })), false)
  assert.equal(hasRevenueProof(candidate({ summary: 'The founder reports $1.3k MRR from 42 paying customers.' })), true)
})

test('assigns every story to one primary section', () => {
  assert.equal(primarySection(candidate()), 'Codex/Claude/AI编程')
  assert.equal(primarySection(candidate({ tags: ['赚钱案例'] })), '赚钱案例/创作者收益')
})

test('collapses adjacent posts from the same source into one story', () => {
  const first = candidate({ source: '@OpenAI', published_at: '2026-06-18T21:34:39.000Z' })
  const second = candidate({ source: '@OpenAI', published_at: '2026-06-18T21:34:41.000Z' })
  assert.equal(isNearDuplicate(first, second), true)
})

test('email plan counts unique materials and excludes top story from category sections', () => {
  const first = enrichOpportunity(candidate({ id: '1', url: 'https://example.com/1', publishable: true, audience_signal: 20000 }))
  const second = enrichOpportunity(candidate({ id: '2', url: 'https://example.com/2', publishable: true, audience_signal: 0, title: 'Chrome extension for AI workflows' }))
  const cards = buildOpportunityCards([first, second])
  const plan = buildEmailPlan([first, second], [], cards)
  assert.ok(plan.unique_material_count <= 4)
  assert.equal(plan.source_status_in_email, false)
  assert.deepEqual(plan.section_items, {})
  assert.equal(plan.evidence_index.length, plan.unique_material_count)
})

test('opportunity card includes decision fields and uses open track classification', () => {
  const item = enrichOpportunity(candidate({
    publishable: true,
    title: 'AI Chrome extension launched for batch image workflows',
    summary: 'The browser extension has 12000 users and automates repeated image processing in Chrome.',
    audience_signal: 12000,
  }))
  assert.equal(item.opportunity_track, '自由机会')
  assert.equal(item.opportunity_maturity, '正在增长')
  assert.equal(item.primary_traffic_entry, '应用与插件市场')
  assert.ok(item.decision_score >= 55)
  assert.ok(item.recommended_toolchain.includes('Claude Code'))
})

test('AI revenue disclosure becomes a cross-industry money case', () => {
  const item = enrichOpportunity(candidate({
    publishable: true,
    title: 'AI video studio income report',
    summary: 'The creator reports $12k monthly revenue from an AI YouTube production workflow.',
    revenue_proof: true,
    audience_signal: 10000,
  }))
  assert.equal(item.ai_money_case, true)
  assert.equal(item.opportunity_track, 'AI内容产品')
})

test('estimated revenue stays usable but is labeled as an estimate', () => {
  const item = enrichOpportunity(candidate({
    publishable: true,
    title: 'Estimated revenue for an AI image website',
    summary: 'Based on verified traffic and pricing, the estimated monthly revenue is $8k.',
    revenue_proof: true,
  }))
  assert.equal(item.ai_money_case, true)
  assert.equal(item.revenue_evidence_type, '估算')
})

test('generic AI opinions do not become build opportunities', () => {
  const item = enrichOpportunity(candidate({
    source_type: 'reddit',
    publishable: true,
    title: 'Can an average person change the world using AI?',
    summary: 'A long discussion about barriers, coding expertise, capital, and whether one person could direct a digital crew.',
    tags: ['只观察'],
    audience_signal: 0,
  }))
  assert.equal(item.opportunity_track, '自由机会')
  assert.equal(item.opportunity_eligible, false)
  assert.deepEqual(buildOpportunityCards([item]), [])
})

test('traffic manipulation is excluded from the opportunity pool', () => {
  const item = enrichOpportunity(candidate({
    publishable: true,
    title: 'Script to fake website traffic',
    summary: 'Use a browser automation script to刷流量并操纵Similarweb榜单。',
    tags: ['可做站'],
  }))
  assert.equal(item.eligibility_checks.ethical_gate, false)
  assert.equal(item.opportunity_eligible, false)
})
