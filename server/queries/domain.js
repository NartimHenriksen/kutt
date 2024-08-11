const knex = require("../knex");
const env = require("../env");

async function find(match) {
  if (env.REDIS_ENABLED && match.address) {
    const r = require("../redis");
    const cachedDomain = await r.client.get(redis.key.domain(match.address));
    if (cachedDomain) return JSON.parse(cachedDomain);
  }
  
  const domain = await knex("domains").where(match).first();
  
  if (env.REDIS_ENABLED && domain) {
    const redis = require("../redis");
    redis.client.set(
      redis.key.domain(domain.address),
      JSON.stringify(domain),
      "EX",
      60 * 60 * 6
    );
  }
  
  return domain;
}

function get(match) {
  return knex("domains").where(match);
}

async function add(params) {
  params.address = params.address.toLowerCase();
  const exists = await knex("domains").where("address", params.address).first();
  
  const newDomain = {
    address: params.address,
    homepage: params.homepage || null,
    user_id: params.user_id || null,
    banned: !!params.banned
  };
  
  let domain;
  if (exists) {
    const [response] = await knex("domains")
      .where("id", exists.id)
      .update(
        {
          ...newDomain,
          updated_at: params.updated_at || new Date().toISOString()
        },
        "*"
      );
    domain = response;
  } else {
    const [response] = await knex("domains").insert(newDomain, "*");
    domain = response;
  }
  
  if (env.REDIS_ENABLED) {
    const redis = require('../redis');
    redis.remove.domain(domain);
  }
  
  return domain;
}

async function update(match, update) {
  const domains = await knex("domains")
    .where(match)
    .update({ ...update, updated_at: new Date().toISOString() }, "*");
  
  if (env.REDIS_ENABLED) {
    const redis = require('../redis');
    domains.forEach(redis.remove.domain);
  }
  
  return domains;
}

module.exports = {
  add,
  find,
  get,
  update,
}