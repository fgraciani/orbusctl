import { getBaseUrl, odata } from './client.js';

export interface MeRole {
  Name: string;
  IsAdministrator: boolean;
  LicenseTypeCategoryId: string;
}

export interface FeaturePermissions {
  HasModelAdministrationPermission: boolean;
  HasApiPermission: boolean;
  HasConfigurationPermission: boolean;
  [key: string]: boolean;
}

export interface MeResponse {
  Name: string;
  AccountName: string;
  EmailAddress: string;
  Roles?: MeRole[];
  FeaturePermissions?: FeaturePermissions;
}

export async function fetchMe(token: string): Promise<MeResponse> {
  return odata<MeResponse>(token, `${getBaseUrl()}/odata/Me`);
}

export async function fetchMeWithRoles(token: string): Promise<MeResponse> {
  return odata<MeResponse>(token, `${getBaseUrl()}/odata/Me?$expand=Roles,FeaturePermissions`);
}
