import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import { URL } from 'url';
import { Address } from '../interfaces/address.interface';

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  /**
   * Extracts location data from a Google Maps link
   * @param googleMapsLink - The Google Maps URL (can be shortened)
   * @returns Address object with latitude, longitude, city, state, and country
   *
   * Supports two broad cases:
   * - URLs containing explicit coordinates (q=lat,lng or @lat,lng)
   * - Search URLs that contain an address query (e.g. /maps/search/?api=1&query=...)
   */
  async extractLocationFromMapsLink(googleMapsLink: string): Promise<Address> {
    try {
      // Expand shortened URL if necessary
      let fullUrl = googleMapsLink;
      if (this.isShortenedUrl(googleMapsLink)) {
        fullUrl = await this.expandShortenedUrl(googleMapsLink);
      }

      // 1) Try to extract explicit coordinates from the URL
      const coordinates = this.extractCoordinatesFromUrl(fullUrl);

      if (coordinates) {
        const addressDetails = await this.reverseGeocode(
          coordinates.latitude,
          coordinates.longitude,
        );

        return {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          city: addressDetails.city,
          state: addressDetails.state,
          country: addressDetails.country,
          countryCode: addressDetails.countryCode,
          postalCode: addressDetails.postalCode,
        };
      }

      // 2) Fallback: extract an address query and forward-geocode it
      const addressQuery = this.extractAddressQueryFromUrl(fullUrl);

      if (addressQuery) {
        const result = await this.forwardGeocode(addressQuery);
        if (result) {
          return result;
        }
      }

      this.logger.warn(
        `Could not extract coordinates or address query from Google Maps link: ${fullUrl}`,
      );
      throw new BadRequestException('Could not extract location from Google Maps link');
    } catch (error) {
      const message = (error as any)?.message || String(error);

      if (error instanceof BadRequestException) {
        // User input issue – log as warning to avoid noisy error logs
        this.logger.warn(`Failed to extract location from maps link: ${message}`);
        throw error;
      }

      // Unexpected failure – keep as error
      this.logger.error(`Unexpected error while extracting location from maps link: ${message}`);
      throw new BadRequestException('Invalid Google Maps link or unable to extract location data');
    }
  }

  /**
   * Checks if the URL is a shortened Google Maps URL
   */
  private isShortenedUrl(url: string): boolean {
    return url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps');
  }

  /**
   * Expands a shortened URL by following redirects
   */
  private async expandShortenedUrl(shortenedUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      https
        .get(shortenedUrl, (res) => {
          // Follow redirects
          if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
            const redirectUrl = res.headers.location;
            if (redirectUrl) {
              // If the redirect is still a shortened URL, recursively expand it
              if (this.isShortenedUrl(redirectUrl)) {
                this.expandShortenedUrl(redirectUrl).then(resolve).catch(reject);
              } else {
                resolve(redirectUrl);
              }
            } else {
              reject(new Error('Redirect location not found'));
            }
          } else {
            // If no redirect, return the original URL
            resolve(shortenedUrl);
          }

          // Consume response to free up memory
          res.resume();
        })
        .on('error', (error) => {
          this.logger.error(`Failed to expand shortened URL: ${error.message}`);
          reject(new Error('Failed to expand shortened URL'));
        });
    });
  }

  /**
   * Extracts coordinates from various Google Maps URL formats
   * Supported formats:
   * - https://maps.google.com/?q=40.7128,-74.0060
   * - https://www.google.com/maps?q=40.7128,-74.0060
   * - https://www.google.com/maps/@40.7128,-74.0060,15z
   * - https://maps.app.goo.gl/... (shortened URLs)
   */
  private extractCoordinatesFromUrl(url: string): { latitude: number; longitude: number } | null {
    try {
      // Pattern 1: ?q=lat,lng
      const qPattern = /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
      let match = url.match(qPattern);
      if (match) {
        return {
          latitude: parseFloat(match[1]),
          longitude: parseFloat(match[2]),
        };
      }

      // Pattern 2: @lat,lng
      const atPattern = /@(-?\d+\.?\d*),(-?\d+\.?\d*)/;
      match = url.match(atPattern);
      if (match) {
        return {
          latitude: parseFloat(match[1]),
          longitude: parseFloat(match[2]),
        };
      }

      // Pattern 3: /place/name/@lat,lng
      const placePattern = /\/place\/[^/]+\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/;
      match = url.match(placePattern);
      if (match) {
        return {
          latitude: parseFloat(match[1]),
          longitude: parseFloat(match[2]),
        };
      }

      return null;
    } catch (error) {
      this.logger.error(`Error extracting coordinates from URL: ${error.message}`);
      return null;
    }
  }

  /**
   * Extracts a human-readable address query from Google Maps URLs
   * Supports:
   * - https://www.google.com/maps/search/?api=1&query=1600+Amphitheatre+Parkway,+Mountain+View,+CA
   * - https://www.google.com/maps?q=1600+Amphitheatre+Parkway,+Mountain+View,+CA
   */
  private extractAddressQueryFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url);

      const queryParam = parsed.searchParams.get('q') || parsed.searchParams.get('query');

      if (!queryParam) {
        return null;
      }

      return queryParam.trim();
    } catch (error) {
      this.logger.warn(`Error parsing URL for address query: ${(error as any)?.message}`);
      return null;
    }
  }

  /**
   * Forward geocodes an address string into coordinates + basic location details
   * Uses OpenStreetMap's Nominatim API (no API key required)
   */
  private async forwardGeocode(addressQuery: string): Promise<Address | null> {
    return new Promise((resolve) => {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        addressQuery,
      )}&addressdetails=1&limit=1`;

      const options = {
        headers: {
          'User-Agent': 'MyteGroup-API/1.0', // Required by Nominatim's usage policy
        },
      };

      https
        .get(url, options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              const result = JSON.parse(data);

              if (!Array.isArray(result) || result.length === 0) {
                this.logger.warn(
                  `Forward geocoding returned no results for query: ${addressQuery}`,
                );
                resolve(null);
                return;
              }

              const first = result[0];
              const address = first.address || {};

              const latitude = parseFloat(first.lat);
              const longitude = parseFloat(first.lon);

              if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
                this.logger.warn(
                  `Forward geocoding returned invalid coordinates for query: ${addressQuery}`,
                );
                resolve(null);
                return;
              }

              resolve({
                latitude,
                longitude,
                city:
                  address.city ||
                  address.town ||
                  address.village ||
                  address.municipality ||
                  address.county,
                state: address.state || address.province || address.region,
                country: address.country,
                countryCode: address.country_code?.toUpperCase(),
                postalCode: address.postcode || undefined,
              });
            } catch (error) {
              this.logger.error(
                `Error parsing forward geocoding response: ${(error as any)?.message}`,
              );
              resolve(null);
            }
          });
        })
        .on('error', (error) => {
          this.logger.error(`Forward geocoding request failed: ${error.message}`);
          resolve(null);
        });
    });
  }

  /**
   * Reverse geocodes coordinates to get address details
   * Uses OpenStreetMap's Nominatim API (free, no API key required)
   */
  private async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<{
    city?: string;
    state?: string;
    country?: string;
    countryCode?: string;
    postalCode?: string;
  }> {
    return new Promise((resolve) => {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;

      const options = {
        headers: {
          'User-Agent': 'MyteGroup-API/1.0', // Required by Nominatim's usage policy
        },
      };

      https
        .get(url, options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              const result = JSON.parse(data);

              if (result.error) {
                this.logger.warn(`Reverse geocoding failed: ${result.error}`);
                resolve({
                  city: undefined,
                  state: undefined,
                  country: undefined,
                  countryCode: undefined,
                  postalCode: undefined,
                });
                return;
              }

              const address = result.address || {};

              resolve({
                city:
                  address.city ||
                  address.town ||
                  address.village ||
                  address.municipality ||
                  address.county,
                state: address.state || address.province || address.region,
                country: address.country,
                countryCode: address.country_code?.toUpperCase(),
                postalCode: address.postcode || undefined,
              });
            } catch (error) {
              this.logger.error(`Error parsing reverse geocoding response: ${error.message}`);
              resolve({
                city: undefined,
                state: undefined,
                country: undefined,
                countryCode: undefined,
                postalCode: undefined,
              });
            }
          });
        })
        .on('error', (error) => {
          this.logger.error(`Reverse geocoding request failed: ${error.message}`);
          // Return partial data instead of rejecting
          resolve({
            city: undefined,
            state: undefined,
            country: undefined,
            countryCode: undefined,
            postalCode: undefined,
          });
        });
    });
  }
}
