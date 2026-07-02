<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SettingController extends Controller
{
    /**
     * Return the current user's settings as a flat key => value map,
     * with values decoded back to their original types.
     */
    public function index()
    {
        $settings = Setting::all()->mapWithKeys(function ($setting) {
            return [$setting->key => $this->decode($setting->value)];
        });

        return response()->json($settings);
    }

    /**
     * Bulk create/update settings from a flat { key: value } payload.
     * Used by the Settings screen's "Save changes" button.
     */
    public function bulkUpdate(Request $request)
    {
        foreach ($request->all() as $key => $value) {
            Setting::updateOrCreate(
                ['key' => $key],
                ['value' => json_encode($value)]
            );
        }

        return $this->index();
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'key' => [
                'required',
                'string',
                // Unique per user, not globally.
                Rule::unique('settings')->where(fn ($q) => $q->where('user_id', $request->user()->id)),
            ],
            'value' => 'nullable',
            'type' => 'in:string,boolean,number,json',
            'description' => 'nullable|string',
        ]);

        $setting = Setting::create($validated);
        return response()->json($setting, 201);
    }

    public function show($key)
    {
        $setting = Setting::where('key', $key)->firstOrFail();
        return response()->json($setting);
    }

    public function update(Request $request, $key)
    {
        $setting = Setting::where('key', $key)->firstOrFail();

        $validated = $request->validate([
            'value' => 'nullable',
            'description' => 'nullable|string',
        ]);

        $setting->update($validated);
        return response()->json($setting);
    }

    /**
     * Decode a stored value, tolerating legacy plain-string values that
     * were saved before JSON encoding was introduced.
     */
    private function decode($value)
    {
        if ($value === null) {
            return null;
        }

        $decoded = json_decode($value, true);

        return json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
    }
}
