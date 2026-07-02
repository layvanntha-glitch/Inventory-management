<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

/**
 * Master-admin account management. All routes are guarded by the
 * 'role:master_admin' middleware in routes/api.php.
 */
class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query();

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%$search%")
                  ->orWhere('email', 'like', "%$search%");
            });
        }

        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }

        return response()->json($query->orderBy('name')->paginate(20));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:6',
            'role' => ['required', Rule::in(User::ROLES)],
            'active' => 'boolean',
        ]);

        $validated['password'] = Hash::make($validated['password']);

        $user = User::create($validated);

        return response()->json($user, 201);
    }

    public function show($id)
    {
        return response()->json(User::findOrFail($id));
    }

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => 'nullable|string|min:6',
            'role' => ['sometimes', Rule::in(User::ROLES)],
            'active' => 'boolean',
        ]);

        // Guard: never allow the last active master admin to be demoted or
        // deactivated, otherwise the system loses its top-level administrator.
        if ($user->isMasterAdmin()) {
            $demoting = array_key_exists('role', $validated) && $validated['role'] !== 'master_admin';
            $deactivating = array_key_exists('active', $validated) && ! $validated['active'];

            if (($demoting || $deactivating) && $this->activeMasterAdminCount() <= 1) {
                return response()->json([
                    'message' => 'You cannot demote or deactivate the only remaining master admin.',
                ], 422);
            }
        }

        if (! empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);

        return response()->json($user);
    }

    public function destroy(Request $request, $id)
    {
        $user = User::findOrFail($id);

        // Prevent an admin from deleting their own account.
        if ($request->user()->id === $user->id) {
            return response()->json(['message' => 'You cannot delete your own account.'], 422);
        }

        if ($user->isMasterAdmin() && $this->activeMasterAdminCount() <= 1) {
            return response()->json([
                'message' => 'You cannot delete the only remaining master admin.',
            ], 422);
        }

        $user->delete();

        return response()->json(['message' => 'User deleted successfully']);
    }

    private function activeMasterAdminCount(): int
    {
        return User::where('role', 'master_admin')->where('active', true)->count();
    }
}
