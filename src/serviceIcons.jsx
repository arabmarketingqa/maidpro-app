import React from 'react';
import {
  Armchair, Car, Construction, HardHat, Sparkles, Package,
  BrushCleaning, Droplets, SprayCan, Sun, Utensils, Bath, Waves,
  Shirt, Bed, Building, Home, Trash2, Wind, Leaf, Calendar,
  Users, Clock, CheckCircle, ShieldCheck, Eraser, MapPin,
} from 'lucide-react';

export const SVC_ICONS = {
  Armchair, Car, Construction, HardHat, Sparkles, Package,
  Broom: BrushCleaning, Droplets, SprayCan, Sun, Utensils, Bath, Waves,
  Shirt, Bed, Building, Home, Trash2, Wind, Leaf, Calendar,
  Users, Clock, CheckCircle, ShieldCheck, Eraser, MapPin,
};

export const SVC_ICON_NAMES = Object.keys(SVC_ICONS);

export const SvcIcon = ({ name, className = 'w-5 h-5', strokeWidth = 1.75 }) => {
  const C = SVC_ICONS[name];
  return C ? <C className={className} strokeWidth={strokeWidth} /> : null;
};
