export type BreezyImagePool = 'ready' | 'focus' | 'break' | 'air' | 'celebrate' | 'quiet'

export const mascotPools: Record<BreezyImagePool, readonly string[]> = {
  ready: ['/mascots/mascot-standard.png', '/mascots/mascot-hello.png', '/mascots/mascot-notification.png'],
  focus: ['/mascots/mascot-book.png', '/mascots/mascot-engineer.png', '/mascots/mascot-idea.png', '/mascots/mascot-mission.png', '/mascots/mascot-reading.png', '/mascots/mascot-reading-indoors.png', '/mascots/mascot-thinking.png'],
  break: ['/mascots/mascot-coffee.png', '/mascots/mascot-enjoy-weather.png', '/mascots/mascot-enjoy-weather-alt.png', '/mascots/mascot-sleep.png', '/mascots/mascot-tv.png'],
  air: ['/mascots/mascot-location-services.png', '/mascots/mascot-mask.png', '/mascots/mascot-wear-mask.png', '/mascots/mascot-cigarette-low.png', '/mascots/mascot-cigarette-high.png'],
  celebrate: ['/mascots/mascot-baby.png', '/mascots/mascot-hello.png', '/mascots/mascot-idea.png'],
  quiet: ['/mascots/mascot-standard.png', '/mascots/mascot-doctor.png']
}
