import { CONFIG } from '../../../config/constants';

interface GoogleGeocodeAddressComponent {
	readonly types: ReadonlyArray<string>;
}

interface GoogleGeocodeResult {
	readonly formatted_address: string;
	readonly types: ReadonlyArray<string>;
	readonly geometry: {
		readonly location_type?: string;
	};
	readonly address_components: ReadonlyArray<GoogleGeocodeAddressComponent>;
}

interface GoogleGeocodeResponse {
	readonly status: string;
	readonly results: ReadonlyArray<GoogleGeocodeResult>;
	readonly error_message?: string;
}

export function scoreGeocodeResult(result: GoogleGeocodeResult): number {
	let score = 0;
	const types = result.types ?? [];

	if (types.includes('street_address')) score += 100;
	if (types.includes('subpremise')) score += 80;
	if (types.includes('premise')) score += 70;
	if (types.includes('establishment')) score += 60;

	if (result.geometry.location_type === 'ROOFTOP') {
		score += 50;
	}

	const components = result.address_components ?? [];

	if (components.some((component) => component.types.includes('postal_code'))) {
		score += 10;
	}

	if (components.some((component) => component.types.includes('landmark'))) {
		score += 15;
	}

	return score;
}

function selectBestGeocodeResult(results: ReadonlyArray<GoogleGeocodeResult>): GoogleGeocodeResult | null {
	if (results.length === 0) {
		return null;
	}

	return results.reduce<GoogleGeocodeResult | null>((bestResult, candidate) => {
		if (bestResult === null) {
			return candidate;
		}

		return scoreGeocodeResult(candidate) > scoreGeocodeResult(bestResult) ? candidate : bestResult;
	}, null);
}

function buildGeocodeUrl(latitude: number, longitude: number): string {
	const params = new URLSearchParams({
		latlng: `${latitude},${longitude}`,
		key: CONFIG.LOCATION.GOOGLE_GEOCODING_API_KEY,
	});

	return `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;
}

export class ReverseGeocodingService {
	public async resolveAddress(latitude: number, longitude: number): Promise<string | null> {
		if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
			throw new Error('Latitude and longitude are required for reverse geocoding.');
		}

		if (!CONFIG.LOCATION.GOOGLE_GEOCODING_API_KEY) {
			throw new Error('GOOGLE_GEOCODING_API_KEY is required to resolve locations.');
		}

		const response = await fetch(buildGeocodeUrl(latitude, longitude));
		if (!response.ok) {
			throw new Error(`Google geocoding request failed with status ${response.status}.`);
		}

		const payload = (await response.json()) as GoogleGeocodeResponse;
		if (payload.status !== 'OK' && payload.status !== 'ZERO_RESULTS') {
			throw new Error(payload.error_message || `Google geocoding returned status ${payload.status}.`);
		}

		const bestResult = selectBestGeocodeResult(payload.results);
		return bestResult?.formatted_address ?? null;
	}
}

export const reverseGeocodingService = new ReverseGeocodingService();