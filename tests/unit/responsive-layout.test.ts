import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('responsive tracker layout', () => {
  it('keeps the task composer free of dividers around the category controls', () => {
    const css = readFileSync(resolve(__dirname, '../../frontend/assets/main.css'), 'utf8')
    const composerRules = css.match(/\.task-composer\s*{([^}]*)}/)?.[1] ?? ''
    const timerFaceRules = css.match(/\.timer-face\s*{([^}]*)}/)?.[1] ?? ''

    expect(composerRules).not.toMatch(/border-top:/)
    expect(composerRules).not.toMatch(/border-bottom:/)
    expect(composerRules).toMatch(/padding:\s*6px 0 16px;/)
    expect(timerFaceRules).toMatch(/padding:\s*18px 0;/)
  })

  it('presents timer metrics as unboxed icon-and-text items', () => {
    const css = readFileSync(resolve(__dirname, '../../frontend/assets/main.css'), 'utf8')
    const panel = readFileSync(resolve(__dirname, '../../frontend/features/tracking/TimerPanel.vue'), 'utf8')
    const statRules = css.match(/\.timer-stats div\s*{([^}]*)}/)?.[1] ?? ''
    const iconRules = css.match(/\.timer-stat-icon\s*{([^}]*)}/)?.[1] ?? ''

    expect(statRules).not.toMatch(/border:/)
    expect(statRules).not.toMatch(/background:/)
    expect(statRules).toMatch(/grid-template-areas:/)
    expect(iconRules).toMatch(/stroke:\s*currentColor;/)
    expect(panel.match(/class="timer-stat-icon"/g)).toHaveLength(3)
    expect(panel.match(/aria-hidden="true"/g)?.length).toBeGreaterThanOrEqual(3)
    expect(css).not.toMatch(/\.timer-stats div \+ div::before/)
  })

  it('presents tracking and Breezy as one divided workspace card', () => {
    const css = readFileSync(resolve(__dirname, '../../frontend/assets/main.css'), 'utf8')
    const mobileRules = css.slice(css.indexOf('@media (max-width: 820px)'))
    const workspaceRules = css.match(/\.tracking-workspace\s*{([^}]*)}/)?.[1] ?? ''
    const breezyRules = css.match(/\.tracking-workspace\s*>\s*\.breezy-panel\s*{([^}]*)}/)?.[1] ?? ''
    const separatorRules = css.match(/\.tracking-workspace\s*>\s*\.breezy-panel::before\s*{([^}]*)}/)?.[1] ?? ''

    expect(workspaceRules).toMatch(/grid-template-columns:\s*minmax\(0,\s*1\.25fr\)\s*minmax\(300px,\s*0\.75fr\);/)
    expect(workspaceRules).toMatch(/border:\s*1px solid var\(--border\);/)
    expect(breezyRules).toMatch(/position:\s*relative;/)
    expect(breezyRules).toMatch(/background:\s*var\(--surface\);/)
    expect(separatorRules).toMatch(/top:\s*20px;/)
    expect(separatorRules).toMatch(/bottom:\s*20px;/)
    expect(separatorRules).toMatch(/width:\s*1px;/)
    expect(mobileRules).toMatch(/\.tracking-workspace\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/)
    expect(mobileRules).toMatch(/\.tracking-workspace\s*>\s*\.breezy-panel::before\s*{[^}]*right:\s*20px;[^}]*left:\s*20px;[^}]*height:\s*1px;/)
  })

  it('stretches Breezy to the tracking row height on desktop and centers its content', () => {
    const css = readFileSync(resolve(__dirname, '../../frontend/assets/main.css'), 'utf8')
    const mobileRules = css.slice(css.indexOf('@media (max-width: 820px)'))
    const breezyPanelRules = css.match(/\.breezy-panel\s*{([^}]*)}/)?.[1] ?? ''

    expect(breezyPanelRules).toMatch(/align-self:\s*stretch;/)
    expect(breezyPanelRules).toMatch(/align-content:\s*center;/)
    expect(breezyPanelRules).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\);/)
    expect(breezyPanelRules).toMatch(/justify-items:\s*center;/)
    expect(breezyPanelRules).toMatch(/text-align:\s*center;/)
    expect(mobileRules).toMatch(/\.breezy-panel\s*{[^}]*align-self:\s*start;/)
  })

  it('allows the single mobile track column to shrink below table min-content width', () => {
    const css = readFileSync(resolve(__dirname, '../../frontend/assets/main.css'), 'utf8')
    const mobileRules = css.slice(css.indexOf('@media (max-width: 820px)'))

    expect(mobileRules).toMatch(
      /\.track-grid,[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/
    )
  })

  it('contains horizontal scrolling inside the entries table on mobile', () => {
    const css = readFileSync(resolve(__dirname, '../../frontend/assets/main.css'), 'utf8')
    const mobileRules = css.slice(css.indexOf('@media (max-width: 820px)'))

    expect(css).toMatch(/\.entry-table-scroll\s*{[^}]*overflow-x:\s*auto;/)
    expect(mobileRules).toMatch(/html,\s*\n\s*body\s*{[^}]*overflow-x:\s*hidden;/)
  })

  it('stacks the personal dashboard before its controls can overflow', () => {
    const css = readFileSync(resolve(__dirname, '../../frontend/assets/main.css'), 'utf8')
    const desktopRules = css.slice(css.indexOf('@media (max-width: 1280px)'))
    const compactRules = css.slice(css.indexOf('@media (max-width: 1100px)'))

    expect(desktopRules).toMatch(/\.personal-overview-controls\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/)
    expect(compactRules).toMatch(/\.personal-dashboard-grid\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/)
    expect(compactRules).toMatch(/grid-template-areas:[\s\S]*?"overview"[\s\S]*?"rail";/)
  })

  it('keeps the company overview and chart in one main card with separate side cards', () => {
    const css = readFileSync(resolve(__dirname, '../../frontend/assets/main.css'), 'utf8')
    const dashboard = readFileSync(resolve(__dirname, '../../frontend/features/dashboard/CompanyDashboard.vue'), 'utf8')
    const compactRules = css.slice(css.indexOf('@media (max-width: 1100px)'))
    const mobileRules = css.slice(css.indexOf('@media (max-width: 820px)'))

    expect(dashboard).toMatch(/class="card pad company-main-card"/)
    expect(dashboard).toMatch(/class="company-main-divider"/)
    expect(dashboard).toMatch(/class="company-side-column"/)
    expect(dashboard).toMatch(/class="card pad company-active-card"/)
    expect(dashboard).toMatch(/<WorkSignalsCard/)
    expect(dashboard).toMatch(/<BlockerPatternsCard/)
    expect(dashboard).not.toMatch(/<WorkSignalsCard\s+embedded/)
    expect(dashboard).not.toMatch(/<BlockerPatternsCard embedded/)
    expect(css).toMatch(/\.company-main-card\s*{[^}]*display:\s*grid;/)
    expect(css).toMatch(/\.company-side-column\s*{[^}]*display:\s*grid;/)
    expect(css).toMatch(/\.company-active-card\s*{[^}]*display:\s*grid;/)
    expect(css).toMatch(/\.company-hours-heading\s*{[^}]*display:\s*flex;/)
    expect(css).toMatch(/\.company-hours-summary\s*{[^}]*justify-items:\s*start;/)
    expect(css).not.toMatch(/\.company-hours-summary\s*{[^}]*grid-template-columns:/)
    expect(css).toMatch(/\.company-overview-section\s*{[^}]*grid-template-columns:\s*minmax\(220px,\s*0\.7fr\)\s*minmax\(0,\s*1\.3fr\);/)
    expect(compactRules).toMatch(/\.company-dashboard-grid\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/)
    expect(mobileRules).toMatch(/\.company-overview-section\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/)
  })
})
