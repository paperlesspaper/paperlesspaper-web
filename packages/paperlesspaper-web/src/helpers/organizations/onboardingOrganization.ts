const ONBOARDING_SOURCE = "device-onboarding";
const ONBOARDING_PENDING_STATUS = "device-pending";
const ONBOARDING_COMPLETE_STATUS = "complete";

type OnboardingStatus =
  | typeof ONBOARDING_PENDING_STATUS
  | typeof ONBOARDING_COMPLETE_STATUS;

type OnboardingQuery = Record<string, any>;

type Organization = {
  id?: string;
  meta?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
};

const getStringValue = (value: any) => {
  if (Array.isArray(value)) return value[0] ? String(value[0]) : undefined;
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
};

export const isIncompleteOnboardingOrganization = (organization?: Organization) =>
  organization?.meta?.onboarding?.source === ONBOARDING_SOURCE &&
  organization?.meta?.onboarding?.status === ONBOARDING_PENDING_STATUS;

export const findReusableOnboardingOrganization = (
  organizations: Organization[] = [],
  currentQuery: OnboardingQuery = {},
) => {
  const action = getStringValue(currentQuery.action);
  const pendingOrganizations = organizations.filter(
    isIncompleteOnboardingOrganization,
  );

  const matchingAction = pendingOrganizations.find(
    (organization) => organization.meta?.onboarding?.action === action,
  );

  return matchingAction || pendingOrganizations[0];
};

export const buildOnboardingMeta = ({
  status,
  query = {},
  userId,
  existingMeta = {},
}: {
  status: OnboardingStatus;
  query?: OnboardingQuery;
  userId?: string;
  existingMeta?: Record<string, any>;
}) => {
  const previousOnboarding = existingMeta.onboarding || {};
  const now = new Date().toISOString();

  return {
    ...existingMeta,
    onboarding: {
      ...previousOnboarding,
      source: ONBOARDING_SOURCE,
      status,
      startedAt: previousOnboarding.startedAt || now,
      completedAt:
        status === ONBOARDING_COMPLETE_STATUS
          ? now
          : previousOnboarding.completedAt,
      userId: userId || previousOnboarding.userId,
      action: getStringValue(query.action) || previousOnboarding.action,
      patient: getStringValue(query.patient) || previousOnboarding.patient,
      firstName:
        getStringValue(query.firstName) || previousOnboarding.firstName,
      lastName: getStringValue(query.lastName) || previousOnboarding.lastName,
      role: getStringValue(query.role) || previousOnboarding.role,
    },
  };
};

