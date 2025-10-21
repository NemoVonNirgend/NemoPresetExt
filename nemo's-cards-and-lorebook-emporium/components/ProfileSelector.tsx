import React, { useState, useEffect } from 'react';
import { sillyTavernIntegration } from '../sillytavern-integration';

export const ProfileSelector: React.FC = () => {
    const [profiles, setProfiles] = useState(sillyTavernIntegration.getProfiles());
    const [activeProfileId, setActiveProfileId] = useState(sillyTavernIntegration.getActiveProfileId());
    const [isChanging, setIsChanging] = useState(false);

    // Update when context changes
    useEffect(() => {
        const handleContextUpdate = () => {
            setProfiles(sillyTavernIntegration.getProfiles());
            setActiveProfileId(sillyTavernIntegration.getActiveProfileId());
        };

        // Listen for context updates
        window.addEventListener('st-context-update', handleContextUpdate);

        return () => {
            window.removeEventListener('st-context-update', handleContextUpdate);
        };
    }, []);

    const handleProfileChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newProfileId = event.target.value;
        setIsChanging(true);

        try {
            await sillyTavernIntegration.setActiveProfile(newProfileId);
            setActiveProfileId(newProfileId);
        } catch (error) {
            console.error('Failed to change profile:', error);
            alert(`Failed to change profile: ${error.message}`);
        } finally {
            setIsChanging(false);
        }
    };

    // Don't show if not in SillyTavern or no profiles
    if (!sillyTavernIntegration.isInSillyTavern() || profiles.length === 0) {
        return null;
    }

    return (
        <div className="mb-4 p-4 bg-parchment-dark rounded-lg border-2 border-sepia">
            <label htmlFor="profile-selector" className="block text-sm font-semibold text-sepia-dark mb-2">
                Connection Profile:
            </label>
            <select
                id="profile-selector"
                value={activeProfileId || ''}
                onChange={handleProfileChange}
                disabled={isChanging}
                className="w-full px-3 py-2 bg-parchment border-2 border-sepia rounded text-sepia-dark font-body disabled:opacity-50"
            >
                {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                        {profile.name} ({profile.api})
                    </option>
                ))}
            </select>
            <p className="text-xs text-sepia-light mt-2">
                Select which API connection to use for generation
            </p>
        </div>
    );
};
