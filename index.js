"use strict";
const geojsonVt = require("geojson-vt");
const vtPbf = require("vt-pbf");
const zlib = require("zlib");
const NodeCache = require("node-cache" );
const _ = require("lodash");
const flatten = require('flat');
const fetch = require('node-fetch');

const url = process.env.CIFS_URL || "https://raw.githubusercontent.com/stadtnavi/tilelive-cifs/main/cifs/test.cifs.json";

const getGeoJson = (url, callback) => {
  const promises = url.split(",").map(url => fetch(url));

  Promise.all(promises)
    .then(results => Promise.all(results.map(r => r.json())))
    .then(results => {
      // combine all incidents
      const incidents = _.reduceRight(results, (result, other) => result.concat(other.incidents), []);
      const geojson = cifsToGeoJson({incidents: incidents});
      callback(null, geojson);
    })
    .catch(e => console.log(e));
};

// i haven't been able to find a way to directly generate the vector tiles, so
// we take a detour via geojson.
// if you know of a way to do it directly, let me know.
const cifsToGeoJson = json => {

  const features = json.incidents.map(incident => {

    const mode = incident.mode || [];
    incident.mode = mode.join(",");

    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: cifsPolylineToGeoJson(incident.location.polyline)
      },
      properties: flatten(incident)
    };
  });

  return {
    type: "FeatureCollection",
    features: features
  };
};

const cifsPolylineToGeoJson = (linestring) => {
  return _.chunk(linestring.trim().split(" "), 2)
    // reverse order from lat,lon (CIFS) to lon, lat (GeoJSON)
    .map(c => [c[1], c[0]]);
};

class CifsSource {
  constructor(uri, callback) {
    this.cacheKey = "tileindex";
    this.cache = new NodeCache({ stdTTL: 600, useClones: false });
    this.url = url;
    callback(null, this);
  }

  fetchGeoJson(callback){
    getGeoJson(this.url, (err, geojson) => {
      if (err) {
        callback(err);
        return;
      }
      callback(geojson);
    });
  }

  getTile(z, x, y, callback) {
    if(this.cache.get(this.cacheKey)) {
      const geojson = this.cache.get(this.cacheKey);
      this.computeTile(geojson, z, x, y, callback);
    } else {
      this.fetchGeoJson((geojson) => {
        this.cache.set(this.cacheKey, geojson);
        this.computeTile(geojson, z, x, y, callback);
      });
    }
  }

  computeTile(geoJson, z, x, y, callback) {
    const tileIndex = geojsonVt(geoJson, { maxZoom: 20, buffer: 512 });
    let tile = tileIndex.getTile(z, x, y);
    if (tile === null) {
      tile = { features: [] };
    }

    const data = Buffer.from(vtPbf.fromGeojsonVt({ cifs: tile }));

    zlib.gzip(data, function(err, buffer) {
      if (err) {
        callback(err);
        return;
      }

      callback(null, buffer, { "content-encoding": "gzip", "cache-control": "public,max-age=120" });
    });
  }

  getInfo(callback) {
    callback(null, {
      format: "pbf",
      maxzoom: 20,
      vector_layers: [
        {
          description: "Roadworks data retrieved from CIFS source",
          id: "cifs"
        }
      ]
    });
  }
}

module.exports = CifsSource;

module.exports.registerProtocols = tilelive => {
  tilelive.protocols["cifs:"] = CifsSource;
};

module.exports.cifsToGeoJson = cifsToGeoJson;
