# Crime data

`crime_hotspots.csv` is empty on purpose: **no public, geotagged crime dataset exists for Indian cities** (NCRB publishes only
state / district totals). Until you add real hotspots, the app uses a *simulated* crime-density layer (clearly labelled "demo").

To use real data (for example hotspots given by the local police, or digitised from a crime report), add one row per hotspot:

    lat,lng,radius_m,severity
    18.1066,83.3955,400,0.8

`severity` is 0 (low) to 1 (very high). Restart the server. The app then shows "Crime data: hotspot file" instead of "simulated".
