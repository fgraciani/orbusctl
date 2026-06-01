import { getBaseUrl, odata } from './client.js';
export async function fetchMe(token) {
    return odata(token, `${getBaseUrl()}/odata/Me`);
}
export async function fetchMeWithRoles(token) {
    return odata(token, `${getBaseUrl()}/odata/Me?$expand=Roles,FeaturePermissions`);
}
