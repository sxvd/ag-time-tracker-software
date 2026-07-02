import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

globalThis.React = React
globalThis.ReactDOM = { createRoot }

await import('./domain/data.js')
await import('./domain/selectors.js')
await import('./ui/components.jsx')
await import('./ui/breezy.jsx')
await import('./ui/FeedbackModal.jsx')
await import('./state/store.jsx')
await import('./views/PersonalView.jsx')
await import('./views/CompanyView.jsx')
await import('./views/JourneyView.jsx')
await import('./views/MiscViews.jsx')
await import('./views/TodayView.jsx')
await import('./app/app.jsx')
