const fs = require("fs");
const assert = require("assert");
const { cifsToGeoJson } = require("./index");
const CifsSource = require("./index");

describe("CifsSource", function() {
  it("convert to GeoJSON", () => {
    const data = fs.readFileSync('cifs/herrenberg.cifs.json', 'utf8')
    const json = JSON.parse(data);

    assert(json.incidents.length == 6);

    const geoJson = cifsToGeoJson(json);
    fs.writeFileSync("cifs/herrenberg.geojson", JSON.stringify(geoJson, null, 2));
  });

  it("fetch data", (done) => {
    const url = "https://raw.githubusercontent.com/stadtnavi/tilelive-cifs/main/cifs/herrenberg.cifs.json";
    const source = new CifsSource(url, () => {});
    source.url = url;
    assert.ok(source);

    // request tile in Herrenberg
    source.getTile(18, 137526, 90476, (err, response) => {
      assert.ok(response.length > 100);
      assert.ok(response);

      // request another tile
      // should come from the cache
      source.getTile(18, 137526, 90476, (err, response) => {
        assert.ok(response.length > 100);
        assert.ok(response);
        assert.ok(source.cache.has(source.cacheKey));
        done();
      })

    })
  });
});
