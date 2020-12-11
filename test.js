var assert = require("assert");
var ParkApiSource = require("./index");

describe("ParkApiSource", function() {
  it("fetch data", (done) => {
    const url = "https://api.stadtnavi.de/parkapi.json";
    const source = new ParkApiSource(url, () => {});
    source.url = url;
    assert.ok(source);

    // request tile in Herrenberg
    source.getTile(16, 34382, 22618, (err, response) => {
      assert.ok(response.length > 100);
      assert.ok(response);

      // request another tile
      // should come from the cache
      source.getTile(16, 34382, 22618, (err, response) => {
        assert.ok(response.length > 100);
        assert.ok(response);
        assert.ok(source.cache.has(source.cacheKey));
      })

      done();
    })
  });
});
