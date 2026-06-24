export const PAYMENT_OPTIONS = ['Online', 'Cash', 'Cheque'] as const;

export type BuildingFormState = {
  name: string;
  address: string;
  has_wings: boolean;
  wings: string;
  late_fees_enabled: boolean;
  late_fees_amount: string;
  water_reading_enabled: boolean;
  payment_methods: string[];
};

export const defaultBuildingForm = (): BuildingFormState => ({
  name: '',
  address: '',
  has_wings: false,
  wings: '',
  late_fees_enabled: false,
  late_fees_amount: '',
  water_reading_enabled: false,
  payment_methods: ['Online', 'Cash', 'Cheque'],
});

export const parsePaymentMethods = (pm?: string) => {
  const parsed = (pm || '').split(',').map((m) => m.trim()).filter(Boolean);
  return parsed.length ? parsed : ['Online'];
};

export type BuildingApiRow = {
  id: string;
  name: string;
  address?: string;
  has_wings?: boolean;
  wings?: string;
  late_fees_enabled?: boolean;
  late_fees_amount?: number | string | null;
  water_reading_enabled?: boolean;
  payment_method?: string;
  payment_tc?: string | null;
};

export const buildingToForm = (building: BuildingApiRow): BuildingFormState => ({
  name: building.name || '',
  address: building.address || '',
  has_wings: !!building.has_wings,
  wings: building.wings || '',
  late_fees_enabled: !!building.late_fees_enabled,
  late_fees_amount: building.late_fees_amount != null ? String(building.late_fees_amount) : '',
  water_reading_enabled: !!building.water_reading_enabled,
  payment_methods: parsePaymentMethods(building.payment_method),
});
