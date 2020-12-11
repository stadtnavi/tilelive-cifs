"use strict";
const geojsonVt = require("geojson-vt");
const vtPbf = require("vt-pbf");
const request = require("requestretry");
const zlib = require("zlib");
const NodeCache = require( "node-cache" );

const url = "https://api.parkendd.de/Ulm";

const getGeoJson = (url, callback) => {
  request(
    {
      url: url,
      maxAttempts: 20,
      retryDelay: 30000,
      retryStrategy: (err, response) =>
        request.RetryStrategies.HTTPOrNetworkError(err, response) ||
        (response && 202 === response.statusCode)
    },
    function(err, res, body) {
      if (err) {
        console.log(`Error when downloading CIFS data from ${url}: ${err} ${res} ${body}`);
        callback(err);
        return;
      }
      callback(null, parkApiToGeoJson(body));
    }
  );
};

// i haven't been able to find a way to directly generate the vector tiles, so
// we take a detour via geojson.
// if you know of a way to do it directly, let me know.
const parkApiToGeoJson = data => {
  const json = JSON.parse(data);

  const features = json.lots.map(lot => {
    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [lot.coords.lng, lot.coords.lat]
      },
      // lat/long is a little superfluous, given that it's in the geometry above, but not removing it keeps the code simpler
      properties: lot
    };
  });

  return {
    type: "FeatureCollection",
    features: features
  };
};

class CifsSource {
  constructor(uri, callback) {
    this.cacheKey = "tileindex";
    this.cache = new NodeCache({ stdTTL: 60, useClones: false });
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

    const data = Buffer.from(vtPbf.fromGeojsonVt({ parking: tile }));

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
          description: "Parking lots data retrieved from a ParkAPI source",
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
