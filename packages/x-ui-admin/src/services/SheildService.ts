import { QueryBodyType } from "@bluelibs/x-ui";
import { UiCrudSecurity, UICrudSecurityByRole } from "../defs";

function safeIntersect(config, source): QueryBodyType {
  const keys = Object.keys(config);
  for (let key of keys) {
    if (!source[key] || source[key] === 0) delete config[key];
    else {
      if (typeof config[key] !== "number") {
        config[key] = safeIntersect(config[key], source[key]);
      } else {
        config[key] = source[key];
      }
    }
  }
  return config;
}

export function getSheildedRequestBody<T = any>(
  user,
  requestBody: QueryBodyType,
  config: UiCrudSecurity<T>
): QueryBodyType {
  let roleConfig: any = getRoleConfig(user, "find", config);
  if (!roleConfig) {
    requestBody = undefined;
  } else if (typeof roleConfig !== "boolean") {
    if (roleConfig.intersect)
      requestBody = safeIntersect(requestBody, roleConfig.intersect);
  }
  return requestBody;
}

export function sheildField<T = any>(
  user,
  type: "find" | "create" | "edit" | "filters",
  fieldId: string,
  crudSecurityConfig: UiCrudSecurity<T>
): boolean {
  let roleConfig: any = getRoleConfig(user, type, crudSecurityConfig);
  switch (type) {
    case "find":
      if (typeof roleConfig === "boolean" && roleConfig === true) return true;
      if (!roleConfig) return false;
      if (roleConfig.intersect) {
        let allow = true;
        let obj = roleConfig.intersect;
        fieldId.split(".").map((key) => {
          if (obj[key]) {
            obj = obj[key];
          } else allow = false;
        });
        return allow;
      }
      return true;

      return false;
    case "create":
      if (typeof roleConfig === "boolean" && roleConfig === true) return true;
      if (!roleConfig) return false;
      if (roleConfig.allow) {
        return roleConfig.allow.some((key) => fieldId.indexOf(key) === 0);
      }
      if (roleConfig.deny) {
        return roleConfig.deny.every((key) => fieldId.indexOf(key) !== 0);
      }
      return true;
    case "edit":
      if (!sheildField(user, "find", fieldId, crudSecurityConfig)) return false;
      if (typeof roleConfig === "boolean" && roleConfig === true) return true;
      if (!roleConfig) return false;
      if (roleConfig.allow) {
        return roleConfig.allow.some((key) => fieldId.indexOf(key) === 0);
      }
      if (roleConfig.deny) {
        return roleConfig.deny.every((key) => fieldId.indexOf(key) !== 0);
      }
      return true;
    case "filters":
      return true;
  }
}

export function sheildCrudOperation<T = any>(
  user,
  type: "find" | "delete" | "create" | "edit" | "filters",
  item: any,
  crudSecurityConfig: UiCrudSecurity<T>
): boolean {
  let roleConfig: any = getRoleConfig(user, type, crudSecurityConfig);
  switch (type) {
    case "find":
      if (!roleConfig) return false;
      return true;
    case "create":
      if (!roleConfig) return false;
      if (roleConfig.own) {
        return isOwner(item, roleConfig.own, user);
      }
      return true;
    case "edit":
      if (!roleConfig) return false;
      if (roleConfig.own) {
        return isOwner(item, roleConfig.own, user);
      }
      return true;
    case "delete":
      if (!roleConfig) return false;
      if (roleConfig.own) {
        return isOwner(item, roleConfig.own, user);
      }
      return true;
    case "filters":
      return true;
  }
}

function getRoleConfig<T = any>(
  user,
  opearationKey: "find" | "delete" | "create" | "edit" | "filters",
  config: UiCrudSecurity<T>
): UICrudSecurityByRole {
  let roleConfig;
  const choosedRole = Object.keys(config?.roles).find(
    (r) =>
      user?.roles?.some((ur) => ur === r) &&
      config?.roles?.[opearationKey] !== undefined
  );
  if (choosedRole)
    roleConfig =
      typeof config.roles[choosedRole] === "boolean"
        ? config.roles[choosedRole]
        : config.roles[choosedRole][opearationKey];
  else
    roleConfig =
      typeof config.defaults === "boolean"
        ? config.defaults
        : config.defaults[opearationKey];
  return roleConfig;
}

function isOwner(item, ownerConfig, user): boolean {
  if (typeof ownerConfig === "string") {
    return item[ownerConfig] === user._id;
  } else if (
    Array.isArray(ownerConfig) &&
    ownerConfig.length === 2 &&
    ownerConfig.every((x) => typeof x === "string")
  ) {
    return item[ownerConfig[0]] === user[ownerConfig[1]];
  } else if (Array.isArray(ownerConfig)) {
    return ownerConfig.reduce(
      (prev, curr) => prev && isOwner(item, curr, user),
      true
    );
  } else {
    let own = true;
    if (ownerConfig["$or"]) {
      own = ownerConfig.reduce(
        (prev, curr) => prev || isOwner(item, curr, user),
        true
      );
    }
    if (ownerConfig["$and"]) {
      own =
        own &&
        ownerConfig.reduce(
          (prev, curr) => prev && isOwner(item, curr, user),
          true
        );
    }
    return own;
  }
}
