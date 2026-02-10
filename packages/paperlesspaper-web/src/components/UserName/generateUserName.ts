export const generateUserName = (patient: any): string => {
  if (patient?.auth0User?.app_metadata?.first_name) {
    return `${patient.auth0User.app_metadata.first_name} ${patient.auth0User.app_metadata.last_name}`;
  }
  if (patient?.auth0User?.family_name) {
    return `${patient.auth0User.given_name} ${patient.auth0User.family_name}`;
  }

  if (patient && patient?.auth0User) {
    return patient.auth0User.name;
  }

  if (patient && patient.status === "invited" && patient.email) {
    return patient.email;
  }

  if (patient && patient.status === "invited") {
    return `invited user`;
  }
  return null;
};
