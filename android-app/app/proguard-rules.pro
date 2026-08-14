# Proguard rules
-keep class com.upialert.app.DonationModel { *; }
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
