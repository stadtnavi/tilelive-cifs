const fs = require("fs");
const assert = require("assert");
const { cifsToGeoJson } = require("./index");
const CifsSource = require("./index");

describe("CifsSource", function() {
  it("convert to GeoJSON", () => {
    const data = fs.readFileSync('cifs/test.cifs.json', 'utf8')
    const json = JSON.parse(data);

    assert(json.incidents.length == 1);

    const geoJson = cifsToGeoJson(json);
    const expected = fs.readFileSync("cifs/herrenberg.geojson");

    const actual = JSON.stringify(geoJson, null, 2);

    //fs.writeFileSync("cifs/herrenberg.geojson", actual);
    assert(expected == actual);
  });

  it("convert Ludwigsburg to GeoJSON", () => {
    const data = fs.readFileSync('cifs/ludwigsburg.cifs.json', 'utf8')
    const json = JSON.parse(data);

    assert(json.incidents.length == 21);

    const geoJson = cifsToGeoJson(json);
    const expected = fs.readFileSync("cifs/ludwigsburg.geojson", "utf8");

    const actual = JSON.stringify(geoJson, null, 2);

    //fs.writeFileSync("cifs/ludwigsburg.geojson", actual, "utf8");
    assert.equal(expected, actual);
  });

  it("fetch data", (done) => {
    const url = "https://raw.githubusercontent.com/stadtnavi/tilelive-cifs/main/cifs/test.cifs.json,https://data.mfdz.de/mfdz/cifs_arbeitsstellen_svz_bw/body.json";
    const source = new CifsSource(null, () => {});
    source.url = url;
    assert.ok(source);

    // request tile in Herrenberg
    source.getTile(17, 68767, 45238, (err, response) => {
      assert.ok(response.length > 100);
      assert.ok(response);

      // request another tile
      // should come from the cache
      source.getTile(17, 68767, 45238, (err, response) => {
        assert.equal(1118, response.length);
        assert.ok(response);
        assert.ok(source.cache.has(source.cacheKey));
        done();
      })

    })
  }).timeout(15000);

  it("fetch line with identical coordinates", (done) => {
    const url = "https://raw.githubusercontent.com/stadtnavi/tilelive-cifs/main/cifs/ludwigsburg.cifs.json";
    const source = new CifsSource(null, () => {});
    source.url = url;
    assert.ok(source);

    // request tile in Ludwigsburg
    source.getTile(17, 68880, 45071, (err, response) => {

      assert.equal(405, response.length);
      assert.ok(response);

      done()
    })
  }).timeout(15000);

});
