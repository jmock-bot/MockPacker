import type { IconName } from '../components/Icon';

/** Activity catalog: the picker in trip creation + hints for the packing engine. */

export interface ActivityKind {
  id: string;
  label: string;
  icon: IconName;
  defaultDress?: string;
  defaultSetting?: 'indoor' | 'outdoor' | 'mixed';
  defaultIntensity?: 'low' | 'moderate' | 'high';
}

export const ACTIVITY_KINDS: ActivityKind[] = [
  { id: 'flight', label: 'Flying', icon: 'plane', defaultSetting: 'indoor' },
  { id: 'road_trip', label: 'Road trip', icon: 'car', defaultSetting: 'mixed' },
  { id: 'business', label: 'Business meetings', icon: 'briefcase', defaultDress: 'business', defaultSetting: 'indoor' },
  { id: 'conference', label: 'Conference', icon: 'users', defaultDress: 'business', defaultSetting: 'indoor' },
  { id: 'wedding', label: 'Wedding', icon: 'heart', defaultDress: 'formal', defaultSetting: 'mixed' },
  { id: 'formal_dinner', label: 'Formal dinner', icon: 'glass', defaultDress: 'formal', defaultSetting: 'indoor' },
  { id: 'casual_dinner', label: 'Casual dinner', icon: 'utensils', defaultDress: 'smart casual', defaultSetting: 'indoor' },
  { id: 'nightlife', label: 'Nightlife', icon: 'moon', defaultDress: 'smart casual', defaultSetting: 'indoor' },
  { id: 'beach', label: 'Beach', icon: 'sun', defaultDress: 'swim', defaultSetting: 'outdoor', defaultIntensity: 'moderate' },
  { id: 'pool', label: 'Pool', icon: 'waves', defaultDress: 'swim', defaultSetting: 'outdoor' },
  { id: 'hiking', label: 'Hiking', icon: 'mountain', defaultDress: 'athletic', defaultSetting: 'outdoor', defaultIntensity: 'high' },
  { id: 'camping', label: 'Camping', icon: 'tent', defaultSetting: 'outdoor', defaultIntensity: 'moderate' },
  { id: 'golf', label: 'Golf', icon: 'flag', defaultSetting: 'outdoor', defaultIntensity: 'moderate' },
  { id: 'skiing', label: 'Skiing / snow', icon: 'snowflake', defaultDress: 'athletic', defaultSetting: 'outdoor', defaultIntensity: 'high' },
  { id: 'theme_park', label: 'Theme park', icon: 'party', defaultSetting: 'outdoor', defaultIntensity: 'high' },
  { id: 'cruise_day', label: 'Cruise day', icon: 'compass', defaultSetting: 'mixed' },
  { id: 'worship', label: 'Worship service', icon: 'home', defaultDress: 'smart casual', defaultSetting: 'indoor' },
  { id: 'family', label: 'Family gathering', icon: 'users', defaultSetting: 'mixed' },
  { id: 'photography', label: 'Photography', icon: 'camera', defaultDress: 'themed', defaultSetting: 'outdoor' },
  { id: 'exercise', label: 'Exercise', icon: 'fire', defaultDress: 'athletic', defaultIntensity: 'high' },
  { id: 'sporting_event', label: 'Sporting event', icon: 'star', defaultSetting: 'outdoor' },
  { id: 'concert', label: 'Concert', icon: 'music', defaultSetting: 'mixed' },
  { id: 'shopping', label: 'Shopping', icon: 'cart', defaultSetting: 'indoor' },
  { id: 'sightseeing', label: 'Sightseeing', icon: 'pin', defaultSetting: 'outdoor', defaultIntensity: 'moderate' },
  { id: 'outdoor', label: 'Outdoor activities', icon: 'wind', defaultSetting: 'outdoor', defaultIntensity: 'moderate' },
  { id: 'custom', label: 'Custom activity', icon: 'sparkle' },
];

export const activityKind = (id: string): ActivityKind =>
  ACTIVITY_KINDS.find((k) => k.id === id) ?? ACTIVITY_KINDS[ACTIVITY_KINDS.length - 1];

export const activityIcon = (id: string): IconName => activityKind(id).icon;
