import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import { Address } from '../interfaces/address.interface';

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  /**
   * Extracts location data from a Google Maps link
   * @param googleMapsLink - The Google Maps URL (can be shortened)
   * @returns Address object with latitude, longitude, city, state, and country
   */
  async extractLocationFromMapsLink(googleMapsLink: string): Promise<Address> {
    try {
      // Expand shortened URL if necessary
      let fullUrl = googleMapsLink;
      if (this.isShortenedUrl(googleMapsLink)) {
        fullUrl = await this.expandShortenedUrl(googleMapsLink);
      }

      // Extract coordinates from the Google Maps link
      const coordinates = this.extractCoordinatesFromUrl(fullUrl);

      if (!coordinates) {
        throw new BadRequestException('Could not extract coordinates from Google Maps link');
      }

      // Reverse geocode to get address details
      const addressDetails = await this.reverseGeocode(coordinates.latitude, coordinates.longitude);

      return {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        city: addressDetails.city,
        state: addressDetails.state,
        country: addressDetails.country,
      };
    } catch (error) {
      this.logger.error(`Failed to extract location from maps link: ${error.message}`);
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
   * Reverse geocodes coordinates to get address details
   * Uses OpenStreetMap's Nominatim API (free, no API key required)
   */
  private async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<{ city?: string; state?: string; country?: string }> {
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
                resolve({ city: undefined, state: undefined, country: undefined });
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
              });
            } catch (error) {
              this.logger.error(`Error parsing reverse geocoding response: ${error.message}`);
              resolve({ city: undefined, state: undefined, country: undefined });
            }
          });
        })
        .on('error', (error) => {
          this.logger.error(`Reverse geocoding request failed: ${error.message}`);
          // Return partial data instead of rejecting
          resolve({ city: undefined, state: undefined, country: undefined });
        });
    });
  }
}
