/** Activity catalog: the picker in trip creation + hints for the packing engine. */

export interface ActivityKind {
  id: string;
  label: string;
  icon: string;
  defaultDress?: string;
  defaultSetting?: 'indoor' | 'outdoor' | 'mixed';
  defaultIntensity?: 'low' | 'moderate' | 'high';
}

export const ACTIVITY_KINDS: ActivityKind[] = [
  { id: 'flight', label: 'Flying', icon: '✈️', defaultSetting: 'indoor' },
  { id: 'road_trip', label: 'Road trip', icon: '🚗', defaultSetting: 'mixed' },
  { id: 'business', label: 'Business meetings', icon: '💼', defaultDress: 'business', defaultSetting: 'indoor' },
  { id: 'conference', label: 'Conference', icon: '🎤', defaultDress: 'business', defaultSetting: 'indoor' },
  { id: 'wedding', label: 'Wedding', icon: '💍', defaultDress: 'formal', defaultSetting: 'mixed' },
  { id: 'formal_dinner', label: 'Formal dinner', icon: '🥂', defaultDress: 'formal', defaultSetting: 'indoor' },
  { id: 'casual_dinner', label: 'Casual dinner', icon: '🍽️', defaultDress: 'smart casual', defaultSetting: 'indoor' },
  { id: 'nightlife', label: 'Nightlife', icon: '🌃', defaultDress: 'smart casual', defaultSetting: 'indoor' },
  { id: 'beach', label: 'Beach', icon: '🏖️', defaultDress: 'swim', defaultSetting: 'outdoor', defaultIntensity: 'moderate' },
  { id: 'pool', label: 'Pool', icon: '🏊', defaultDress: 'swim', defaultSetting: 'outdoor' },
  { id: 'hiking', label: 'Hiking', icon: '🥾', defaultDress: 'athletic', defaultSetting: 'outdoor', defaultIntensity: 'high' },
  { id: 'camping', label: 'Camping', icon: '🏕️', defaultSetting: 'outdoor', defaultIntensity: 'moderate' },
  { id: 'golf', label: 'Golf', icon: '⛳', defaultSetting: 'outdoor', defaultIntensity: 'moderate' },
  { id: 'skiing', label: 'Skiing / snow', icon: '🎿', defaultDress: 'athletic', defaultSetting: 'outdoor', defaultIntensity: 'high' },
  { id: 'theme_park', label: 'Theme park', icon: '🎢', defaultSetting: 'outdoor', defaultIntensity: 'high' },
  { id: 'cruise_day', label: 'Cruise day', icon: '🛳️', defaultSetting: 'mixed' },
  { id: 'worship', label: 'Worship service', icon: '⛪', defaultDress: 'smart casual', defaultSetting: 'indoor' },
  { id: 'family', label: 'Family gathering', icon: '👨‍👩‍👧‍👦', defaultSetting: 'mixed' },
  { id: 'photography', label: 'Photography', icon: '📸', defaultDress: 'themed', defaultSetting: 'outdoor' },
  { id: 'exercise', label: 'Exercise', icon: '🏋️', defaultDress: 'athletic', defaultIntensity: 'high' },
  { id: 'sporting_event', label: 'Sporting event', icon: '🏟️', defaultSetting: 'outdoor' },
  { id: 'concert', label: 'Concert', icon: '🎶', defaultSetting: 'mixed' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️', defaultSetting: 'indoor' },
  { id: 'sightseeing', label: 'Sightseeing', icon: '🗺️', defaultSetting: 'outdoor', defaultIntensity: 'moderate' },
  { id: 'outdoor', label: 'Outdoor activities', icon: '🌲', defaultSetting: 'outdoor', defaultIntensity: 'moderate' },
  { id: 'custom', label: 'Custom activity', icon: '✨' },
];

export const activityKind = (id: string): ActivityKind =>
  ACTIVITY_KINDS.find((k) => k.id === id) ?? ACTIVITY_KINDS[ACTIVITY_KINDS.length - 1];

export const activityIcon = (id: string): string => activityKind(id).icon;
